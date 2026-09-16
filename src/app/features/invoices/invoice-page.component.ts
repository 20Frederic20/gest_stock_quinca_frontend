import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { Invoice, PendingLine } from '../../core/models/invoice.model';
import { Delivery } from '../../core/models/delivery.model';
import { Payment } from '../../core/models/payment.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { formatDate } from '../articles/article-format';
import { CustomersService } from '../customers/customers.service';
import { InvoiceDeliveriesComponent } from '../deliveries/invoice-deliveries.component';
import { InvoicePaymentsComponent } from '../payments/invoice-payments.component';
import { formatMoney } from '../pricing/price-rules';
import { CancelInvoiceFormComponent } from './cancel-invoice-form.component';
import { InvoiceAlertsComponent } from './invoice-alerts.component';
import { InvoiceLineFormComponent } from './invoice-line-form.component';
import { InvoiceLinesComponent } from './invoice-lines.component';
import { InvoiceTransportComponent } from './invoice-transport.component';
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  DOCUMENT_TYPE_LABELS,
  DELIVERY_STATUS_LABELS,
  isCancellable,
  toLineRequest,
  validationSummary,
} from './invoice-format';
import { InvoicesService } from './invoices.service';

/**
 * One document on a full page: lines on the left, totals and actions on the right.
 * A draft is edited here; a validated or cancelled document is only read, printed or cancelled.
 */
@Component({
  selector: 'app-invoice-page',
  imports: [
    RouterLink,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    InvoiceLinesComponent,
    InvoiceLineFormComponent,
    InvoiceAlertsComponent,
    InvoiceTransportComponent,
    InvoicePaymentsComponent,
    InvoiceDeliveriesComponent,
    CancelInvoiceFormComponent,
  ],
  templateUrl: './invoice-page.component.html',
  styleUrl: './invoice-page.component.css',
})
export class InvoicePageComponent {
  private service = inject(InvoicesService);
  private customersService = inject(CustomersService);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** From the route, through component input binding. */
  id = input.required<string>();

  invoice = signal<Invoice | null>(null);
  /** Gives the price grid of the new lines and the contact details. */
  customer = signal<Customer | null>(null);
  /** Credit situation of the customer, for the warnings of a draft. Null while unknown. */
  credit = signal<CustomerCredit | null>(null);
  loading = signal(false);
  /** Loading failure: nothing else can be shown. */
  error = signal<string | null>(null);
  /** Action failure: shown above the document, which stays visible. */
  actionError = signal<string | null>(null);
  notice = signal<string | null>(null);

  canWrite = computed(() => this.auth.can('sales.write'));
  canCancel = computed(() => this.auth.can('sales.cancel'));
  /** A cashier takes payments without being allowed to sell; only a manager undoes one. */
  canPay = computed(() => this.auth.can('payments.write'));
  canCancelPayment = computed(() => this.auth.can('payments.cancel'));
  /** Handing the goods over belongs to whoever sells, not to the till. */
  canDeliver = computed(() => this.auth.can('deliveries.write'));
  canCancelDelivery = computed(() => this.auth.can('deliveries.cancel'));
  isDraft = computed(() => this.invoice()?.status === 'DRAFT');
  editable = computed(() => this.isDraft() && this.canWrite());
  cancellable = computed(() => {
    const invoice = this.invoice();
    return invoice !== null && this.canCancel() && isCancellable(invoice);
  });

  heading = computed(() => {
    const invoice = this.invoice();
    return invoice ? `${DOCUMENT_TYPE_LABELS[invoice.type]} ${invoice.number}` : '';
  });

  validating = signal(false);
  /** A line on its way to the backend: the form waits for the answer before composing the next one. */
  addingLine = signal(false);
  askingValidation = signal(false);
  askingDelete = signal(false);
  cancelOpen = signal(false);

  validationMessage = computed(() => {
    const invoice = this.invoice();
    return invoice ? validationSummary(invoice) : '';
  });

  deleteMessage = computed(
    () => `Le brouillon ${this.invoice()?.number ?? ''} et toutes ses lignes seront supprimés.`,
  );

  protected statusLabels = DOCUMENT_STATUS_LABELS;
  protected statusTones = DOCUMENT_STATUS_TONES;
  protected deliveryLabels = DELIVERY_STATUS_LABELS;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

  private request?: Subscription;

  constructor() {
    // The component is reused when the route goes from one document to another.
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  load(id = this.id()): void {
    this.request?.unsubscribe();
    if (this.invoice()?.id !== id) this.invoice.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.request = this.service.getById(id).subscribe({
      next: invoice => {
        this.invoice.set(invoice);
        this.loading.set(false);
        this.loadCustomer(invoice.customerId);
        // Only a draft can still be fixed: on a locked document the warnings would be noise.
        if (invoice.status === 'DRAFT') this.loadCredit(invoice.customerId);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  /** The form composed a line: the page is the one that saves it, and shows the refusal if any. */
  addLine(line: PendingLine): void {
    const invoice = this.invoice();
    if (!invoice) return;

    this.addingLine.set(true);
    this.actionError.set(null);

    this.service.addLine(invoice.id, toLineRequest(line)).subscribe({
      next: updated => {
        this.addingLine.set(false);
        this.invoice.set(updated);
      },
      error: (error: ApiError) => {
        this.addingLine.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  /** A line was added, changed or removed: the backend sent the document with its new totals. */
  onInvoiceChanged(invoice: Invoice): void {
    this.invoice.set(invoice);
    this.actionError.set(null);
    this.notice.set(null);
  }

  /**
   * A payment was taken or cancelled. The answer carries the invoice as it then stands, so the totals
   * follow without loading the document again.
   */
  onPaymentChanged(payment: Payment): void {
    this.invoice.update(invoice =>
      invoice === null
        ? null
        : { ...invoice, paidAmount: payment.invoicePaidAmount, remainingToPay: payment.invoiceRemainingToPay },
    );
    this.actionError.set(null);
  }

  /**
   * A delivery note was written or cancelled. Its answer says where the invoice then stands — its
   * status and, line by line, what is left to hand over — so nothing has to be loaded again.
   */
  onDeliveryChanged(delivery: Delivery): void {
    this.invoice.update(invoice => {
      if (invoice === null) return null;

      const lines = invoice.lines.map(line => {
        const moved = delivery.lines.find(deliveryLine => deliveryLine.invoiceLineId === line.id);
        return moved
          ? { ...line, deliveredQuantity: moved.deliveredQuantity, remainingToDeliver: moved.remainingToDeliver }
          : line;
      });

      return { ...invoice, deliveryStatus: delivery.invoiceDeliveryStatus, lines };
    });
    this.actionError.set(null);
  }

  onActionFailed(message: string): void {
    this.actionError.set(message);
  }

  askValidation(): void {
    this.askingValidation.set(true);
  }

  validate(): void {
    this.askingValidation.set(false);
    const invoice = this.invoice();
    if (!invoice) return;

    this.validating.set(true);
    this.actionError.set(null);

    this.service.validate(invoice.id).subscribe({
      next: validated => {
        this.validating.set(false);
        this.invoice.set(validated);
        this.notice.set('Document validé.');
      },
      error: (error: ApiError) => {
        this.validating.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  askDelete(): void {
    this.askingDelete.set(true);
  }

  deleteDraft(): void {
    this.askingDelete.set(false);
    const invoice = this.invoice();
    if (!invoice) return;

    this.actionError.set(null);
    this.service.deleteDraft(invoice.id).subscribe({
      next: () => this.router.navigate(['/invoices']),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  openCancel(): void {
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    this.cancelOpen.set(false);
  }

  onCancelled(invoice: Invoice): void {
    this.cancelOpen.set(false);
    this.invoice.set(invoice);
    this.notice.set('Document annulé.');
  }

  /** A failure stays silent: the warning is a comfort, the backend is the one that decides. */
  private loadCredit(customerId: string): void {
    this.customersService.getCredit(customerId).subscribe({
      next: credit => this.credit.set(credit),
      error: () => this.credit.set(null),
    });
  }

  private loadCustomer(customerId: string): void {
    if (this.customer()?.id === customerId) return;

    this.customersService.getById(customerId).subscribe({
      next: customer => this.customer.set(customer),
      error: (error: ApiError) => this.actionError.set(`Client indisponible : ${error.message}`),
    });
  }
}
