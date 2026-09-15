import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { AgencyStock } from '../../core/models/stock.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { InventoryFormComponent } from './inventory-form.component';
import { StockDetailComponent } from './stock-detail.component';
import { formatQuantity } from './stock-format';
import { StockService } from './stock.service';

type DrawerMode = 'detail' | 'inventory';

/** Stock > État du stock: the stock of one agency, the user's own by default. */
@Component({
  selector: 'app-stock-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    DrawerComponent,
    StockDetailComponent,
    InventoryFormComponent,
  ],
  templateUrl: './stock-list.component.html',
  styleUrl: './stock-list.component.css',
})
export class StockListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(StockService);
  private agenciesService = inject(AgenciesService);

  agencies = signal<Agency[]>([]);
  agencyOptions = computed<SelectOption[]>(() =>
    this.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );

  /** The agency whose stock is shown. */
  agencyId = signal(this.auth.user()?.agencyId ?? '');
  agencyLabel = computed(
    () => this.agencies().find(a => a.id === this.agencyId())?.label ?? this.auth.user()?.agencyLabel ?? '',
  );
  alertsOnly = signal(false);

  /** Other agencies are for managers and administrators; sellers and cashiers see their own. */
  canChooseAgency = computed(() => this.auth.can('stock.viewAll'));
  /** Inventory counts: in one's own agency for a manager, anywhere for an administrator. */
  canAct = computed(() => this.auth.can('stock.act', this.agencyId()));

  lines = signal<AgencyStock[]>([]);
  /** null in alerts mode, which is not paginated. */
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);

  emptyMessage = computed(() =>
    this.alertsOnly()
      ? 'Aucun article sous son seuil d’alerte dans cette agence.'
      : 'Aucun stock enregistré dans cette agence. Saisissez un inventaire pour commencer.',
  );

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while counting an article chosen by search. */
  selectedLine = signal<AgencyStock | null>(null);
  drawerHeading = computed(() =>
    this.drawerMode() === 'inventory' ? 'Saisir un inventaire' : (this.selectedLine()?.articleDesignation ?? ''),
  );

  protected formatQuantity = formatQuantity;

  private request?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      // The own agency stays shown: only the choice of another one is missing.
      error: () => this.agencies.set([]),
    });
    this.load(0);
  }

  load(page = 0): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    const onError = (error: ApiError) => {
      this.error.set(error.message);
      this.loading.set(false);
    };

    if (this.alertsOnly()) {
      this.request = this.service.getAlerts(this.agencyId()).subscribe({
        next: lines => {
          this.lines.set(lines);
          this.pageInfo.set(null);
          this.loading.set(false);
        },
        error: onError,
      });
      return;
    }

    this.request = this.service.getByAgency(this.agencyId(), page).subscribe({
      next: response => {
        this.lines.set(response.content);
        this.pageInfo.set(toPageInfo(response));
        this.loading.set(false);
      },
      error: onError,
    });
  }

  onAgencySelected(option: SelectOption | null): void {
    if (!option) return;
    this.agencyId.set(option.id);
    this.closeDrawer();
    this.notice.set(null);
    this.load(0);
  }

  setAlertsOnly(alertsOnly: boolean): void {
    this.alertsOnly.set(alertsOnly);
    this.load(0);
  }

  openDetail(line: AgencyStock): void {
    this.selectedLine.set(line);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openInventory(): void {
    this.drawerMode.set('inventory');
  }

  openNewInventory(): void {
    this.selectedLine.set(null);
    this.drawerMode.set('inventory');
    this.drawerOpen.set(true);
  }

  /** Cancelling from a line goes back to its sheet; cancelling a searched article closes the panel. */
  onInventoryCancelled(): void {
    if (this.selectedLine()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedLine.set(null);
  }

  onInventorySaved(): void {
    this.closeDrawer();
    this.notice.set('Inventaire enregistré.');
    this.load(this.pageInfo()?.page ?? 0);
  }
}
