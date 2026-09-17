import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { PurchaseOrderSummary } from '../../core/models/purchase-order.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from './purchase-format';
import { PurchaseOrdersService } from './purchase-orders.service';

/**
 * Achats > Réceptions: what the agency is still waiting for. The goods are received on the order
 * itself, which is where a row leads — the backend knows no reception outside an order.
 */
@Component({
  selector: 'app-reception-list',
  imports: [PageHeaderComponent, SelectSearchComponent, StateViewComponent, BadgeComponent],
  templateUrl: './reception-list.component.html',
  styleUrl: './reception-list.component.css',
})
export class ReceptionListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(PurchaseOrdersService);
  private agenciesService = inject(AgenciesService);
  private router = inject(Router);

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

  orders = signal<PurchaseOrderSummary[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  protected statusLabels = ORDER_STATUS_LABELS;
  protected statusTones = ORDER_STATUS_TONES;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

  private request?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      error: () => this.agencies.set([]),
    });
    this.load();
  }

  load(): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getPending(this.agencyId()).subscribe({
      next: orders => {
        this.orders.set(orders);
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
    this.load();
  }

  open(order: PurchaseOrderSummary): void {
    this.router.navigate(['/purchase-orders', order.id]);
  }
}
