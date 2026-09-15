import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subscription, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { CustomerCredit } from '../../core/models/customer.model';
import { DocumentType } from '../../core/models/invoice.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { paymentTermLabel } from '../customers/customer-detail.component';
import { CustomersService } from '../customers/customers.service';
import { formatMoney } from '../pricing/price-rules';
import { DOCUMENT_TYPE_LABELS } from './invoice-format';
import { InvoicesService } from './invoices.service';

const DEFAULT_TYPE: DocumentType = 'INVOICE';

/**
 * Ventes > Nouvelle vente, first step: who buys, which document, cash or credit.
 * The backend cannot change these afterwards, so they are settled before the draft exists.
 */
@Component({
  selector: 'app-sale-start',
  imports: [ReactiveFormsModule, PageHeaderComponent, SelectSearchComponent, FieldErrorComponent],
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

  customer = signal<SelectOption | null>(null);
  /** Credit situation of the chosen customer: decides whether a credit sale is possible. */
  credit = signal<CustomerCredit | null>(null);
  creditError = signal<string | null>(null);
  typeLabel = signal(DOCUMENT_TYPE_LABELS[DEFAULT_TYPE]);

  saving = signal(false);
  formError = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    customerId: ['', [Validators.required]],
    type: [DEFAULT_TYPE, [Validators.required]],
    // Disabled until a customer allowed to credit is chosen.
    creditMode: [{ value: false, disabled: true }],
  });

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
  protected paymentTermLabel = paymentTermLabel;

  private creditRequest?: Subscription;

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
    if (!option) return;

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

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    this.service.create(this.form.getRawValue()).subscribe({
      next: invoice => {
        this.saving.set(false);
        // Replaces this step in the history: "back" from the draft returns to where the sale started.
        this.router.navigate(['/invoices', invoice.id], { replaceUrl: true });
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/invoices']);
  }
}
