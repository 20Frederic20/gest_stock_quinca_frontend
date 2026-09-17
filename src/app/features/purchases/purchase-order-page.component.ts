import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { PurchaseOrder, PurchaseOrderLineRequest } from '../../core/models/purchase-order.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { CancelOrderFormComponent } from './cancel-order-form.component';
import { OrderReceptionsComponent } from './order-receptions.component';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, orderCancellable } from './purchase-format';
import { PurchaseOrderLineFormComponent } from './purchase-order-line-form.component';
import { PurchaseOrderLinesComponent } from './purchase-order-lines.component';
import { PurchaseOrdersService } from './purchase-orders.service';

/**
 * One purchase order on a full page: its lines on the left, its totals and actions on the right.
 * A draft is filled here; once confirmed, the page follows what the supplier actually delivers.
 */
@Component({
  selector: 'app-purchase-order-page',
  imports: [
    RouterLink,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    PurchaseOrderLinesComponent,
    PurchaseOrderLineFormComponent,
    OrderReceptionsComponent,
    CancelOrderFormComponent,
  ],
  templateUrl: './purchase-order-page.component.html',
  styleUrl: './purchase-order-page.component.css',
})
export class PurchaseOrderPageComponent {
  private service = inject(PurchaseOrdersService);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** From the route, through component input binding. */
  id = input.required<string>();

  order = signal<PurchaseOrder | null>(null);
  loading = signal(false);
  /** Loading failure: nothing else can be shown. */
  error = signal<string | null>(null);
  /** Action failure: shown above the order, which stays visible. */
  actionError = signal<string | null>(null);
  notice = signal<string | null>(null);

  canWrite = computed(() => this.auth.can('purchases.write'));
  isDraft = computed(() => this.order()?.status === 'DRAFT');
  editable = computed(() => this.isDraft() && this.canWrite());
  cancellable = computed(() => {
    const order = this.order();
    return order !== null && this.canWrite() && orderCancellable(order);
  });

  heading = computed(() => {
    const order = this.order();
    return order ? `Commande ${order.number}` : '';
  });

  confirming = signal(false);
  addingLine = signal(false);
  askingConfirmation = signal(false);
  askingDelete = signal(false);
  cancelOpen = signal(false);

  confirmMessage = computed(() => {
    const order = this.order();
    if (!order) return '';

    return (
      `Total : ${formatMoney(order.totalAmount)}. La commande part chez « ${order.supplierName} » : ` +
      'ses quantités et ses prix ne pourront plus être modifiés.'
    );
  });

  deleteMessage = computed(
    () => `Le brouillon ${this.order()?.number ?? ''} et toutes ses lignes seront supprimés.`,
  );

  protected statusLabels = ORDER_STATUS_LABELS;
  protected statusTones = ORDER_STATUS_TONES;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

  private request?: Subscription;

  constructor() {
    // The component is reused when the route goes from one order to another.
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  load(id = this.id()): void {
    this.request?.unsubscribe();
    if (this.order()?.id !== id) this.order.set(null);
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getById(id).subscribe({
      next: order => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  /** The form composed a line: the page is the one that saves it, and shows the refusal if any. */
  addLine(line: PurchaseOrderLineRequest): void {
    const order = this.order();
    if (!order) return;

    this.addingLine.set(true);
    this.actionError.set(null);

    this.service.addLine(order.id, line).subscribe({
      next: updated => {
        this.addingLine.set(false);
        this.order.set(updated);
      },
      error: (error: ApiError) => {
        this.addingLine.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  /** A line changed or was removed: the backend sent the order with its new totals. */
  onOrderChanged(order: PurchaseOrder): void {
    this.order.set(order);
    this.actionError.set(null);
    this.notice.set(null);
  }

  onActionFailed(message: string): void {
    this.actionError.set(message);
  }

  /** A reception moved the order: its lines and its status changed, so it is loaded again. */
  onReceptionChanged(): void {
    this.load();
  }

  askConfirmation(): void {
    this.askingConfirmation.set(true);
  }

  confirmOrder(): void {
    this.askingConfirmation.set(false);
    const order = this.order();
    if (!order) return;

    this.confirming.set(true);
    this.actionError.set(null);

    this.service.confirm(order.id).subscribe({
      next: confirmed => {
        this.confirming.set(false);
        this.order.set(confirmed);
        this.notice.set('Commande confirmée.');
      },
      error: (error: ApiError) => {
        this.confirming.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  askDelete(): void {
    this.askingDelete.set(true);
  }

  deleteDraft(): void {
    this.askingDelete.set(false);
    const order = this.order();
    if (!order) return;

    this.actionError.set(null);
    this.service.deleteDraft(order.id).subscribe({
      next: () => this.router.navigate(['/purchase-orders']),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  openCancel(): void {
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    this.cancelOpen.set(false);
  }

  onCancelled(order: PurchaseOrder): void {
    this.cancelOpen.set(false);
    this.order.set(order);
    this.notice.set('Commande annulée.');
  }
}
