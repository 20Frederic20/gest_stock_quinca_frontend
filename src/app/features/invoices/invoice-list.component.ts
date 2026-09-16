import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Invoice } from '../../core/models/invoice.model';
import { Payment } from '../../core/models/payment.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { isPayable } from '../payments/payment-format';
import { PaymentFormComponent } from '../payments/payment-form.component';
import { CancelInvoiceFormComponent } from './cancel-invoice-form.component';
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  DOCUMENT_TYPE_LABELS,
  isCancellable,
  validationSummary,
} from './invoice-format';
import { InvoicesService } from './invoices.service';

/** Ventes > Factures: the documents of one agency, the user's own by default. A row opens the document. */
@Component({
  selector: 'app-invoice-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    CancelInvoiceFormComponent,
    PaymentFormComponent,
  ],
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.css',
})
export class InvoiceListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(InvoicesService);
  private agenciesService = inject(AgenciesService);
  private router = inject(Router);

  canCreate = computed(() => this.auth.can('sales.write'));
  canCancel = computed(() => this.auth.can('sales.cancel'));
  /** A cashier collects without being allowed to sell. */
  canPay = computed(() => this.auth.can('payments.write'));
  /** Other agencies are for managers and administrators. */
  canChooseAgency = computed(() => this.auth.can('sales.viewAll'));

  agencies = signal<Agency[]>([]);
  agencyOptions = computed<SelectOption[]>(() =>
    this.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );
  agencyId = signal(this.auth.user()?.agencyId ?? '');
  agencyLabel = computed(
    () => this.agencies().find(a => a.id === this.agencyId())?.label ?? this.auth.user()?.agencyLabel ?? '',
  );

  invoices = signal<Invoice[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  /** An action that failed: the list stays as it is, with the reason above it. */
  actionError = signal<string | null>(null);

  /** The document waiting for a confirmation, and what is about to happen to it. */
  pending = signal<{ invoice: Invoice; action: 'validate' | 'delete' } | null>(null);
  /** The validated document whose cancellation reason is being typed. */
  cancelling = signal<Invoice | null>(null);
  /** The invoice being collected, without leaving the list. */
  collecting = signal<Invoice | null>(null);
  busy = signal(false);

  confirmHeading = computed(() =>
    this.pending()?.action === 'validate' ? 'Valider ce document ?' : 'Supprimer ce brouillon ?',
  );

  confirmLabel = computed(() => (this.pending()?.action === 'validate' ? 'Valider' : 'Supprimer'));

  confirmMessage = computed(() => {
    const pending = this.pending();
    if (!pending) return '';

    return pending.action === 'validate'
      ? validationSummary(pending.invoice)
      : `Le brouillon ${pending.invoice.number} et toutes ses lignes seront supprimés.`;
  });

  protected typeLabels = DOCUMENT_TYPE_LABELS;
  protected statusLabels = DOCUMENT_STATUS_LABELS;
  protected statusTones = DOCUMENT_STATUS_TONES;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

  private request?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      // The own agency stays shown: only the choice of another one is missing.
      error: () => this.agencies.set([]),
    });
    this.load(0);
  }

  load(page: number): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getByAgency(this.agencyId(), page).subscribe({
      next: response => {
        this.invoices.set(response.content);
        this.pageInfo.set(toPageInfo(response));
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  onAgencySelected(option: SelectOption | null): void {
    if (!option) return;
    this.agencyId.set(option.id);
    this.load(0);
  }

  /** Same rules as on the document page: a draft is filled or thrown away, a validated one is cancelled. */
  canValidate(invoice: Invoice): boolean {
    return invoice.status === 'DRAFT' && this.canCreate();
  }

  canDelete(invoice: Invoice): boolean {
    return invoice.status === 'DRAFT' && this.canCancel();
  }

  /** Backend rules, plus the permission: a validated invoice that still owes something. */
  canCollect(invoice: Invoice): boolean {
    return this.canPay() && isPayable(invoice);
  }

  canCancelDocument(invoice: Invoice): boolean {
    return this.canCancel() && isCancellable(invoice);
  }

  askValidation(invoice: Invoice): void {
    this.actionError.set(null);
    this.pending.set({ invoice, action: 'validate' });
  }

  askDelete(invoice: Invoice): void {
    this.actionError.set(null);
    this.pending.set({ invoice, action: 'delete' });
  }

  confirm(): void {
    if (this.pending()?.action === 'validate') this.validate();
    else this.deleteDraft();
  }

  validate(): void {
    const pending = this.pending();
    this.pending.set(null);
    if (!pending) return;

    this.busy.set(true);
    this.service.validate(pending.invoice.id).subscribe({
      next: validatedInvoice => {
        this.busy.set(false);
        this.replace(validatedInvoice);
      },
      error: (error: ApiError) => {
        this.busy.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  deleteDraft(): void {
    const pending = this.pending();
    this.pending.set(null);
    if (!pending) return;

    this.busy.set(true);
    this.service.deleteDraft(pending.invoice.id).subscribe({
      // The page is loaded again rather than the row dropped: the pagination must stay true.
      next: () => {
        this.busy.set(false);
        this.load(this.pageInfo()?.page ?? 0);
      },
      error: (error: ApiError) => {
        this.busy.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  openPayment(invoice: Invoice): void {
    this.actionError.set(null);
    this.collecting.set(invoice);
  }

  closePayment(): void {
    this.collecting.set(null);
  }

  /** The answer carries the invoice as it then stands: the row follows without loading the page again. */
  onPaymentTaken(payment: Payment): void {
    this.collecting.set(null);
    this.invoices.update(invoices =>
      invoices.map(invoice =>
        invoice.id === payment.invoiceId
          ? { ...invoice, paidAmount: payment.invoicePaidAmount, remainingToPay: payment.invoiceRemainingToPay }
          : invoice,
      ),
    );
  }

  openCancel(invoice: Invoice): void {
    this.actionError.set(null);
    this.cancelling.set(invoice);
  }

  closeCancel(): void {
    this.cancelling.set(null);
  }

  onCancelled(invoice: Invoice): void {
    this.cancelling.set(null);
    this.replace(invoice);
  }

  /** Puts the document back in the list where it was, with its new status and totals. */
  private replace(invoice: Invoice): void {
    this.invoices.update(invoices => invoices.map(current => (current.id === invoice.id ? invoice : current)));
  }

  open(invoice: Invoice): void {
    this.router.navigate(['/invoices', invoice.id]);
  }

  newSale(): void {
    this.router.navigate(['/new-sale']);
  }
}
