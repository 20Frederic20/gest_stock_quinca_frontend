import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Invoice } from '../../core/models/invoice.model';
import { Payment } from '../../core/models/payment.model';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { CancelPaymentFormComponent } from './cancel-payment-form.component';
import { PAYMENT_METHOD_LABELS, isPayable } from './payment-format';
import { PaymentFormComponent } from './payment-form.component';
import { PaymentsService } from './payments.service';

/**
 * What has been collected on one invoice, and what is left to collect. Every operation answers with
 * the invoice as it then stands, which is handed to the page so the totals follow without a reload.
 */
@Component({
  selector: 'app-invoice-payments',
  imports: [DrawerComponent, PaymentFormComponent, CancelPaymentFormComponent],
  templateUrl: './invoice-payments.component.html',
  styleUrl: './invoice-payments.component.css',
})
export class InvoicePaymentsComponent {
  private service = inject(PaymentsService);

  invoice = input.required<Invoice>();
  canPay = input(false);
  canCancelPayment = input(false);

  /** The payment just taken or cancelled: the page updates the invoice totals from it. */
  changed = output<Payment>();

  payments = signal<Payment[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  formOpen = signal(false);
  cancelling = signal<Payment | null>(null);

  /** Backend rules, plus the permission of the user in front of the screen. */
  payable = computed(() => this.canPay() && isPayable(this.invoice()));

  protected methodLabels = PAYMENT_METHOD_LABELS;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

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

  openCancel(payment: Payment): void {
    this.cancelling.set(payment);
  }

  closeCancel(): void {
    this.cancelling.set(null);
  }

  /** Newest first, like the backend orders them. */
  onTaken(payment: Payment): void {
    this.payments.update(payments => [payment, ...payments]);
    this.formOpen.set(false);
    this.changed.emit(payment);
  }

  onCancelled(payment: Payment): void {
    this.payments.update(payments => payments.map(current => (current.id === payment.id ? payment : current)));
    this.cancelling.set(null);
    this.changed.emit(payment);
  }

  summaryOf(payment: Payment): string {
    return `${payment.number} — ${formatMoney(payment.amount)}`;
  }

  private load(invoiceId: string): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getByInvoice(invoiceId).subscribe({
      next: payments => {
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }
}
