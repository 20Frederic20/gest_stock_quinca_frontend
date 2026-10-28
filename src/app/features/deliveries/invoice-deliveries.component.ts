import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Delivery } from '../../core/models/delivery.model';
import { Invoice } from '../../core/models/invoice.model';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { formatDate, formatNumber } from '../articles/article-format';
import { CancelDeliveryFormComponent } from './cancel-delivery-form.component';
import { isDeliverable } from './delivery-format';
import { DeliveryFormComponent } from './delivery-form.component';
import { DeliveriesService } from './deliveries.service';

/**
 * What has left the shop on one invoice, and what is still owed. Every note answers with where the
 * invoice then stands, which is handed to the page so its lines and its status follow without a reload.
 */
@Component({
  selector: 'app-invoice-deliveries',
  imports: [DrawerComponent, DeliveryFormComponent, CancelDeliveryFormComponent],
  templateUrl: './invoice-deliveries.component.html',
  styleUrl: './invoice-deliveries.component.css',
})
export class InvoiceDeliveriesComponent {
  private service = inject(DeliveriesService);

  invoice = input.required<Invoice>();
  canDeliver = input(false);
  canCancelDelivery = input(false);

  /** The note just written or cancelled: the page updates the invoice from it. */
  changed = output<Delivery>();

  deliveries = signal<Delivery[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  formOpen = signal(false);
  cancelling = signal<Delivery | null>(null);

  /** Backend rules, plus the permission of the user in front of the screen. */
  deliverable = computed(() => this.canDeliver() && isDeliverable(this.invoice()));

  protected formatDate = formatDate;
  protected formatNumber = formatNumber;

  private request?: Subscription;

  constructor() {
    effect(() => {
      const id = this.invoice().id;
      untracked(() => this.load(id));
    });
  }

  openForm(): void {
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  openCancel(delivery: Delivery): void {
    this.cancelling.set(delivery);
  }

  closeCancel(): void {
    this.cancelling.set(null);
  }

  /** Newest first, like the backend orders them. */
  onDelivered(delivery: Delivery): void {
    this.deliveries.update(deliveries => [delivery, ...deliveries]);
    this.formOpen.set(false);
    this.changed.emit(delivery);
  }

  onCancelled(delivery: Delivery): void {
    this.deliveries.update(deliveries =>
      deliveries.map(current => (current.id === delivery.id ? delivery : current)),
    );
    this.cancelling.set(null);
    this.changed.emit(delivery);
  }

  summaryOf(delivery: Delivery): string {
    return `${delivery.number} du ${formatDate(delivery.deliveryDate)}`;
  }

  private load(invoiceId: string): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getByInvoice(invoiceId).subscribe({
      next: deliveries => {
        this.deliveries.set(deliveries);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }
}
