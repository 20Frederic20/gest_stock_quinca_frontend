import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Transfer, TransferLineRequest } from '../../core/models/transfer.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { formatDate } from '../articles/article-format';
import { CancelTransferFormComponent } from './cancel-transfer-form.component';
import { TRANSFER_STATUS_LABELS, TRANSFER_STATUS_TONES, isReceivable, transferCancellable } from './transfer-format';
import { TransferLineFormComponent } from './transfer-line-form.component';
import { TransferLinesComponent } from './transfer-lines.component';
import { TransferReceiveFormComponent } from './transfer-receive-form.component';
import { TransfersService } from './transfers.service';

/**
 * One transfer on a full page: its lines on the left, its status and actions on the right. A draft
 * is filled and sent from the source side; once sent, the destination side receives it from here too.
 */
@Component({
  selector: 'app-transfer-page',
  imports: [
    RouterLink,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    TransferLinesComponent,
    TransferLineFormComponent,
    TransferReceiveFormComponent,
    CancelTransferFormComponent,
  ],
  templateUrl: './transfer-page.component.html',
  styleUrl: './transfer-page.component.css',
})
export class TransferPageComponent {
  private service = inject(TransfersService);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** From the route, through component input binding. */
  id = input.required<string>();

  transfer = signal<Transfer | null>(null);
  loading = signal(false);
  /** Loading failure: nothing else can be shown. */
  error = signal<string | null>(null);
  /** Action failure: shown above the transfer, which stays visible. */
  actionError = signal<string | null>(null);
  notice = signal<string | null>(null);

  /** Only the source agency's own manager (or an admin) ships: the destination has no say here. */
  canShip = computed(() => {
    const transfer = this.transfer();
    return transfer !== null && this.auth.can('transfer.ship', transfer.sourceAgencyId);
  });

  /** Only the destination agency's own manager (or an admin) receives. */
  canReceive = computed(() => {
    const transfer = this.transfer();
    return transfer !== null && this.auth.can('transfer.receive', transfer.destinationAgencyId);
  });

  isDraft = computed(() => this.transfer()?.status === 'DRAFT');
  editable = computed(() => this.isDraft() && this.canShip());
  receivable = computed(() => {
    const transfer = this.transfer();
    return transfer !== null && isReceivable(transfer) && this.canReceive();
  });
  cancellable = computed(() => {
    const transfer = this.transfer();
    return transfer !== null && transferCancellable(transfer) && (this.canShip() || this.canReceive());
  });

  heading = computed(() => {
    const transfer = this.transfer();
    return transfer ? `Transfert ${transfer.number}` : '';
  });

  sending = signal(false);
  addingLine = signal(false);
  askingSend = signal(false);
  askingDelete = signal(false);
  receiveOpen = signal(false);
  cancelOpen = signal(false);

  sendMessage = computed(() => {
    const transfer = this.transfer();
    if (!transfer) return '';

    return (
      `${transfer.lines.length} ligne(s). La marchandise sort du stock de « ${transfer.sourceAgencyLabel} » ` +
      `et part vers « ${transfer.destinationAgencyLabel} ».`
    );
  });

  deleteMessage = computed(
    () => `Le brouillon ${this.transfer()?.number ?? ''} et toutes ses lignes seront supprimés.`,
  );

  protected statusLabels = TRANSFER_STATUS_LABELS;
  protected statusTones = TRANSFER_STATUS_TONES;
  protected formatDate = formatDate;

  private request?: Subscription;

  constructor() {
    // The component is reused when the route goes from one transfer to another.
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  load(id = this.id()): void {
    this.request?.unsubscribe();
    if (this.transfer()?.id !== id) this.transfer.set(null);
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getById(id).subscribe({
      next: transfer => {
        this.transfer.set(transfer);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  /** The form composed a line: the page is the one that saves it, and shows the refusal if any. */
  addLine(line: TransferLineRequest): void {
    const transfer = this.transfer();
    if (!transfer) return;

    this.addingLine.set(true);
    this.actionError.set(null);

    this.service.addLine(transfer.id, line).subscribe({
      next: updated => {
        this.addingLine.set(false);
        this.transfer.set(updated);
      },
      error: (error: ApiError) => {
        this.addingLine.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  /** A line changed or was removed: the backend sent the transfer with its new lines. */
  onTransferChanged(transfer: Transfer): void {
    this.transfer.set(transfer);
    this.actionError.set(null);
    this.notice.set(null);
  }

  onActionFailed(message: string): void {
    this.actionError.set(message);
  }

  askSend(): void {
    this.askingSend.set(true);
  }

  sendTransfer(): void {
    this.askingSend.set(false);
    const transfer = this.transfer();
    if (!transfer) return;

    this.sending.set(true);
    this.actionError.set(null);

    this.service.send(transfer.id).subscribe({
      next: sent => {
        this.sending.set(false);
        this.transfer.set(sent);
        this.notice.set('Transfert envoyé.');
      },
      error: (error: ApiError) => {
        this.sending.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  askDelete(): void {
    this.askingDelete.set(true);
  }

  deleteDraft(): void {
    this.askingDelete.set(false);
    const transfer = this.transfer();
    if (!transfer) return;

    this.actionError.set(null);
    this.service.deleteDraft(transfer.id).subscribe({
      next: () => this.router.navigate(['/transfers']),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  openReceive(): void {
    this.actionError.set(null);
    this.receiveOpen.set(true);
  }

  closeReceive(): void {
    this.receiveOpen.set(false);
  }

  onReceived(transfer: Transfer): void {
    this.receiveOpen.set(false);
    this.transfer.set(transfer);
    this.notice.set('Transfert réceptionné.');
  }

  openCancel(): void {
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    this.cancelOpen.set(false);
  }

  onCancelled(transfer: Transfer): void {
    this.cancelOpen.set(false);
    this.transfer.set(transfer);
    this.notice.set('Transfert annulé.');
  }
}
