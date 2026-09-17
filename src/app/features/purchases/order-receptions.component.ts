import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { PurchaseOrder } from '../../core/models/purchase-order.model';
import { Reception, ReceptionSummary } from '../../core/models/reception.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { formatDate } from '../articles/article-format';
import { CancelReceptionFormComponent } from './cancel-reception-form.component';
import { RECEPTION_STATUS_LABELS, RECEPTION_STATUS_TONES, isReceivable } from './purchase-format';
import { ReceptionFormComponent } from './reception-form.component';
import { ReceptionsService } from './receptions.service';

/**
 * What has arrived against one order. Every operation changes the order too — its lines, its status —
 * so the page is told to load it again rather than guess.
 */
@Component({
  selector: 'app-order-receptions',
  imports: [BadgeComponent, DrawerComponent, ConfirmDialogComponent, ReceptionFormComponent, CancelReceptionFormComponent],
  templateUrl: './order-receptions.component.html',
  styleUrl: './order-receptions.component.css',
})
export class OrderReceptionsComponent {
  private service = inject(ReceptionsService);

  order = input.required<PurchaseOrder>();
  canWrite = input(false);

  /** The order moved: the page loads it again. */
  changed = output<void>();

  receptions = signal<ReceptionSummary[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  actionError = signal<string | null>(null);

  formOpen = signal(false);
  cancelling = signal<ReceptionSummary | null>(null);
  toDelete = signal<ReceptionSummary | null>(null);
  deleteMessage = computed(() => `La réception ${this.toDelete()?.number ?? ''} sera supprimée.`);

  /** Backend rules, plus the permission of the user in front of the screen. */
  receivable = computed(() => this.canWrite() && isReceivable(this.order()));

  protected statusLabels = RECEPTION_STATUS_LABELS;
  protected statusTones = RECEPTION_STATUS_TONES;
  protected formatDate = formatDate;

  private request?: Subscription;

  constructor() {
    effect(() => {
      const id = this.order().id;
      untracked(() => this.load(id));
    });
  }

  openForm(): void {
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  /** Written and confirmed: the stock moved, so the order did too. */
  onReceived(_: Reception): void {
    this.formOpen.set(false);
    this.refresh();
  }

  /** Written but left in draft: it must appear in the list so it is not forgotten. */
  onFailed(_: Reception): void {
    this.load(this.order().id);
  }

  confirm(reception: ReceptionSummary): void {
    this.actionError.set(null);

    this.service.confirm(reception.id).subscribe({
      next: () => this.refresh(),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(reception: ReceptionSummary): void {
    this.actionError.set(null);
    this.toDelete.set(reception);
  }

  cancelDelete(): void {
    this.toDelete.set(null);
  }

  confirmDelete(): void {
    const reception = this.toDelete();
    this.toDelete.set(null);
    if (!reception) return;

    this.service.deleteDraft(reception.id).subscribe({
      next: () => this.load(this.order().id),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  openCancel(reception: ReceptionSummary): void {
    this.actionError.set(null);
    this.cancelling.set(reception);
  }

  closeCancel(): void {
    this.cancelling.set(null);
  }

  /** A cancelled reception takes its goods back out of the stock: the order owes them again. */
  onCancelled(_: Reception): void {
    this.cancelling.set(null);
    this.refresh();
  }

  summaryOf(reception: ReceptionSummary): string {
    return `${reception.number} du ${formatDate(reception.receptionDate)}`;
  }

  private refresh(): void {
    this.load(this.order().id);
    this.changed.emit();
  }

  private load(orderId: string): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getByOrder(orderId).subscribe({
      next: response => {
        this.receptions.set(response.content);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }
}
