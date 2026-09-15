import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Invoice } from '../../core/models/invoice.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_TONES, DOCUMENT_TYPE_LABELS } from './invoice-format';
import { InvoicesService } from './invoices.service';

/** Ventes > Factures: the documents of one agency, the user's own by default. A row opens the document. */
@Component({
  selector: 'app-invoice-list',
  imports: [PageHeaderComponent, SelectSearchComponent, StateViewComponent, PaginationComponent, BadgeComponent],
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.css',
})
export class InvoiceListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(InvoicesService);
  private agenciesService = inject(AgenciesService);
  private router = inject(Router);

  canCreate = computed(() => this.auth.can('sales.write'));
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

  open(invoice: Invoice): void {
    this.router.navigate(['/invoices', invoice.id]);
  }

  newSale(): void {
    this.router.navigate(['/new-sale']);
  }
}
