import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { Payment } from '../../core/models/payment.model';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { CancelPaymentFormComponent } from './cancel-payment-form.component';
import { PAYMENT_METHOD_LABELS } from './payment-format';
import { PaymentsService } from './payments.service';

/** Caisse > Règlements: what an agency has collected, newest first. A row opens its invoice. */
@Component({
  selector: 'app-payment-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    DrawerComponent,
    CancelPaymentFormComponent,
  ],
  templateUrl: './payment-list.component.html',
  styleUrl: './payment-list.component.css',
})
export class PaymentListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(PaymentsService);
  private agenciesService = inject(AgenciesService);
  private router = inject(Router);

  /** Other agencies are for managers and administrators. */
  canChooseAgency = computed(() => this.auth.can('sales.viewAll'));
  canCancelPayment = computed(() => this.auth.can('payments.cancel'));

  agencies = signal<Agency[]>([]);
  agencyOptions = computed<SelectOption[]>(() =>
    this.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );
  agencyId = signal(this.auth.user()?.agencyId ?? '');
  agencyLabel = computed(
    () => this.agencies().find(a => a.id === this.agencyId())?.label ?? this.auth.user()?.agencyLabel ?? '',
  );

  payments = signal<Payment[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  cancelling = signal<Payment | null>(null);

  protected methodLabels = PAYMENT_METHOD_LABELS;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

  private request?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      // The own agency stays shown: only the choice of another one is missing.
      next: agencies => this.agencies.set(agencies),
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
        this.payments.set(response.content);
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

  openInvoice(payment: Payment): void {
    this.router.navigate(['/invoices', payment.invoiceId]);
  }

  openCancel(payment: Payment): void {
    this.cancelling.set(payment);
  }

  closeCancel(): void {
    this.cancelling.set(null);
  }

  onCancelled(payment: Payment): void {
    this.cancelling.set(null);
    this.payments.update(payments => payments.map(current => (current.id === payment.id ? payment : current)));
  }

  summaryOf(payment: Payment): string {
    return `${payment.number} — ${formatMoney(payment.amount)}`;
  }
}
