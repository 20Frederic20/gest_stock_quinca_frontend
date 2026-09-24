import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { PurchaseOrder, PurchaseOrderSummary } from '../../core/models/purchase-order.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from './purchase-format';
import { PurchaseOrderFormComponent } from './purchase-order-form.component';
import { PurchaseOrderLinesComponent } from './purchase-order-lines.component';
import { PurchaseOrdersService } from './purchase-orders.service';

/** Achats > Commandes fournisseurs: the orders of one agency, newest first. A row opens the order. */
@Component({
  selector: 'app-purchase-order-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    DrawerComponent,
    PurchaseOrderFormComponent,
    PurchaseOrderLinesComponent,
  ],
  templateUrl: './purchase-order-list.component.html',
  styleUrl: './purchase-order-list.component.css',
})
export class PurchaseOrderListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(PurchaseOrdersService);
  private agenciesService = inject(AgenciesService);
  private router = inject(Router);

  canWrite = computed(() => this.auth.can('purchases.write'));
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
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  formOpen = signal(false);

  /** The order previewed in the drawer, without leaving the list: only its summary is loaded yet. */
  previewing = signal<PurchaseOrderSummary | null>(null);
  /** Fetched once the drawer opens, since the list only holds summaries. */
  previewOrder = signal<PurchaseOrder | null>(null);
  previewLoading = signal(false);
  previewError = signal<string | null>(null);

  protected statusLabels = ORDER_STATUS_LABELS;
  protected statusTones = ORDER_STATUS_TONES;
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
        this.orders.set(response.content);
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

  open(order: PurchaseOrderSummary): void {
    this.router.navigate(['/purchase-orders', order.id]);
  }

  openPreview(order: PurchaseOrderSummary, event: Event): void {
    event.stopPropagation();
    this.previewing.set(order);
    this.previewOrder.set(null);
    this.previewError.set(null);
    this.previewLoading.set(true);

    this.service.getById(order.id).subscribe({
      next: fullOrder => {
        this.previewOrder.set(fullOrder);
        this.previewLoading.set(false);
      },
      error: (error: ApiError) => {
        this.previewError.set(error.message);
        this.previewLoading.set(false);
      },
    });
  }

  closePreview(): void {
    this.previewing.set(null);
  }

  openCreate(): void {
    this.formOpen.set(true);
  }

  closeCreate(): void {
    this.formOpen.set(false);
  }

  /** The order exists but has no line yet: its own page is where it gets filled. */
  onCreated(order: PurchaseOrder): void {
    this.formOpen.set(false);
    this.router.navigate(['/purchase-orders', order.id]);
  }
}
