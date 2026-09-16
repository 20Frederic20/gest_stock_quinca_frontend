import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subscription, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { DocumentType, Invoice, PendingLine } from '../../core/models/invoice.model';
import { Payment } from '../../core/models/payment.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { paymentTermLabel } from '../customers/customer-detail.component';
import { CustomersService } from '../customers/customers.service';
import { formatMoney } from '../pricing/price-rules';
import { formatNumber } from '../articles/article-format';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PaymentFormComponent } from '../payments/payment-form.component';
import { InvoiceAlertsComponent } from './invoice-alerts.component';
import { DOCUMENT_TYPE_LABELS, previewTotals, toLineRequest } from './invoice-format';
import { InvoiceLineFormComponent } from './invoice-line-form.component';
import { InvoicesService } from './invoices.service';

const DEFAULT_TYPE: DocumentType = 'INVOICE';

/**
 * Ventes > Nouvelle vente : the whole sale on one screen. Who buys, which document, cash or credit,
 * then the articles and the transport. Nothing exists on the backend until « Créer » : the document is
 * saved with its lines in one call, so an abandoned sale leaves neither draft nor consumed number.
 */
@Component({
  selector: 'app-sale-start',
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    SelectSearchComponent,
    FieldErrorComponent,
    InvoiceLineFormComponent,
    InvoiceAlertsComponent,
    DrawerComponent,
    PaymentFormComponent,
  ],
  templateUrl: './sale-start.component.html',
  styleUrl: './sale-start.component.css',
})
export class SaleStartComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private service = inject(InvoicesService);
  private customersService = inject(CustomersService);
  private router = inject(Router);

  canCreate = computed(() => this.auth.can('sales.write'));
  /** The sale is drawn from the agency of the seller, which is the one the backend will use. */
  agencyId = computed(() => this.auth.user()?.agencyId ?? '');
  agencyLabel = computed(() => this.auth.user()?.agencyLabel ?? '');

  customer = signal<SelectOption | null>(null);
  /** The customer itself: its price grid is what prices every line. */
  chosen = signal<Customer | null>(null);
  /** Lines being typed. They reach the backend only when the sale is created. */
  lines = signal<PendingLine[]>([]);
  /** Credit situation of the chosen customer: decides whether a credit sale is possible. */
  credit = signal<CustomerCredit | null>(null);
  creditError = signal<string | null>(null);
  typeLabel = signal(DOCUMENT_TYPE_LABELS[DEFAULT_TYPE]);

  saving = signal(false);
  formError = signal<string | null>(null);
  /** The invoice just created and validated, waiting for its payment. */
  collecting = signal<Invoice | null>(null);
  /** A document that exists on the backend although the sale did not go all the way through. */
  created = signal<Invoice | null>(null);

  form = this.fb.nonNullable.group({
    customerId: ['', [Validators.required]],
    type: [DEFAULT_TYPE, [Validators.required]],
    // Disabled until a customer allowed to credit is chosen.
    creditMode: [{ value: false, disabled: true }],
    // Before VAT, added to the total without passing through the lines.
    transportAmount: [0, [Validators.required, Validators.min(0)]],
  });

  private value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Only a final invoice reserves stock. */
  type = computed(() => this.value().type);

  /** What the backend will compute, shown while the sale is typed. */
  totals = computed(() => previewTotals(this.lines(), this.value().transportAmount || 0));

  typeOptions = computed<SelectOption[]>(() =>
    (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map(type => ({ id: type, label: DOCUMENT_TYPE_LABELS[type] })),
  );

  /** Inactive customers are left out: the backend refuses to sell to them. */
  searchCustomers = (term: string): Observable<SelectOption[]> => {
    const trimmed = term.trim();
    const request = trimmed ? this.customersService.search(trimmed) : this.customersService.getAll();
    return request.pipe(
      map(page => page.content.filter(c => c.active).map(c => ({ id: c.id, label: `${c.code} — ${c.name}` }))),
    );
  };

  protected formatMoney = formatMoney;
  protected formatNumber = formatNumber;
  protected paymentTermLabel = paymentTermLabel;

  private creditRequest?: Subscription;
  private customerRequest?: Subscription;

  /** The form composed a line: it waits here until the sale is created. */
  addLine(line: PendingLine): void {
    this.lines.update(lines => [...lines, line]);
    this.formError.set(null);
  }

  removeLine(index: number): void {
    this.lines.update(lines => lines.filter((_, position) => position !== index));
  }

  /** Amount before VAT of one line, discount deducted. */
  lineNet(line: PendingLine): number {
    return line.quantity * line.unitPrice - (line.quantity * line.unitPrice * line.discountRate) / 100;
  }

  onCustomerSelected(option: SelectOption | null): void {
    const { customerId, creditMode } = this.form.controls;
    this.customer.set(option);
    customerId.setValue(option?.id ?? '');
    customerId.markAsTouched();

    // Whatever was allowed for the previous customer no longer applies.
    creditMode.setValue(false);
    creditMode.disable();
    this.credit.set(null);
    this.creditError.set(null);
    this.creditRequest?.unsubscribe();
    this.customerRequest?.unsubscribe();
    this.chosen.set(null);
    // The prices of the lines come from the grid of the customer: they no longer mean anything.
    this.lines.set([]);
    if (!option) return;

    this.customerRequest = this.customersService.getById(option.id).subscribe({
      next: customer => this.chosen.set(customer),
      error: (error: ApiError) => this.formError.set(error.message),
    });

    this.creditRequest = this.customersService.getCredit(option.id).subscribe({
      next: credit => {
        this.credit.set(credit);
        if (credit.creditAllowed) creditMode.enable();
      },
      error: (error: ApiError) => this.creditError.set(`Situation de crédit indisponible : ${error.message}`),
    });
  }

  onTypeSelected(option: SelectOption | null): void {
    if (!option) return;
    this.form.controls.type.setValue(option.id as DocumentType);
    this.typeLabel.set(option.label);
  }

  /** Creates the document and opens it: the sale will be validated, and paid, later. */
  submit(): void {
    this.save(invoice => this.openCreated(invoice));
  }

  /**
   * The counter sale: create, validate, collect, without leaving the screen. The backend refuses a
   * payment on anything but a validated invoice, so the three calls have to follow one another.
   */
  submitAndCollect(): void {
    this.save(invoice => this.validateThenCollect(invoice));
  }

  /** The payment is taken: the document is now the right place to print it or look at it. */
  onPaymentTaken(payment: Payment): void {
    this.router.navigate(['/invoices', payment.invoiceId], { replaceUrl: true });
  }

  /** The customer will pay later: the invoice exists all the same, so we open it. */
  closePayment(): void {
    const invoice = this.collecting();
    this.collecting.set(null);
    if (invoice) this.openCreated(invoice);
  }

  openCreated(invoice: Invoice): void {
    // Replaces this step in the history: "back" from the document returns to where the sale started.
    this.router.navigate(['/invoices', invoice.id], { replaceUrl: true });
  }

  private save(onCreated: (invoice: Invoice) => void): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.created.set(null);

    const { customerId, type, creditMode, transportAmount } = this.form.getRawValue();

    this.service
      .create({
        customerId,
        type,
        creditMode,
        transportAmount: transportAmount || 0,
        lines: this.lines().map(toLineRequest),
      })
      .subscribe({
        next: invoice => onCreated(invoice),
        error: (error: ApiError) => {
          this.saving.set(false);
          this.formError.set(error.message);
        },
      });
  }

  private validateThenCollect(invoice: Invoice): void {
    this.service.validate(invoice.id).subscribe({
      next: validatedInvoice => {
        this.saving.set(false);
        this.collecting.set(validatedInvoice);
      },
      // The document was created: saying so, with a way to open it, beats losing it.
      error: (error: ApiError) => {
        this.saving.set(false);
        this.created.set(invoice);
        this.formError.set(`Le document ${invoice.number} a été créé mais n’a pas pu être validé : ${error.message}`);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/invoices']);
  }
}
