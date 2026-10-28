import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Dashboard } from '../../core/models/dashboard.model';
import { DayClosing } from '../../core/models/day-closing.model';
import { Invoice } from '../../core/models/invoice.model';
import { AgencyStock, MOVEMENT_TYPE_LABELS, StockMovement } from '../../core/models/stock.model';
import { BadgeComponent, BadgeTone } from '../../shared/badge/badge.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { DayClosingOpenFormComponent } from '../day-closing/day-closing-open-form.component';
import { DayClosingService } from '../day-closing/day-closing.service';
import { InvoicesService } from '../invoices/invoices.service';
import { formatMoney } from '../pricing/price-rules';
import { formatDateTime, formatQuantity, formatSignedQuantity } from '../stock/stock-format';
import { StockService } from '../stock/stock.service';
import { DashboardService } from './dashboard.service';

const RECENT_COUNT = 5;

/** Short enough for a dense table badge; the full sentence lives in invoice-format.ts for detail pages. */
const RETRAIT_LABELS: Record<Invoice['deliveryStatus'], string> = {
  NOT_DELIVERED: 'En attente',
  PARTIALLY_DELIVERED: 'Partiel',
  FULLY_DELIVERED: 'Complet',
};

/**
 * Pilotage > Tableau de bord: what the agency did today, and what is still waiting. Every figure
 * comes from one call to the backend, which counts them in the database — nothing is added up here.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    DayClosingOpenFormComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(DashboardService);
  private agenciesService = inject(AgenciesService);
  private stockService = inject(StockService);
  private invoicesService = inject(InvoicesService);
  private dayClosingService = inject(DayClosingService);

  /** Other agencies are for managers and administrators. */
  canChooseAgency = computed(() => this.auth.can('sales.viewAll'));
  /** A seller doesn't hold the till: no banner, no cash-opening drawer for them. */
  canOpenDayClosing = computed(() => this.auth.can('dayClosing.access'));

  agencies = signal<Agency[]>([]);
  agencyOptions = computed<SelectOption[]>(() =>
    this.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );
  agencyId = signal(this.auth.user()?.agencyId ?? '');
  agencyLabel = computed(
    () => this.agencies().find(a => a.id === this.agencyId())?.label ?? this.auth.user()?.agencyLabel ?? '',
  );

  figures = signal<Dashboard | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  stockAlerts = signal<AgencyStock[]>([]);
  recentMovements = signal<StockMovement[]>([]);
  recentInvoices = signal<Invoice[]>([]);

  /** null tant que le point n'est pas fait : ni "ouverte" ni "à ouvrir" avant l'arrivée de la réponse. */
  currentDayClosing = signal<DayClosing | null>(null);
  dayClosingLoading = signal(false);
  /** La bannière ne s'affiche qu'une fois sûr qu'aucune caisse n'est ouverte, jamais pendant le chargement. */
  showOpenBanner = computed(
    () => this.canOpenDayClosing() && !this.dayClosingLoading() && this.currentDayClosing() === null,
  );
  showOpenDrawer = signal(false);

  /** Nothing in draft, nothing to deliver, nothing to receive, no shortage: the day is clear. */
  nothingWaiting = computed(() => {
    const figures = this.figures();
    if (!figures) return false;

    return (
      figures.draftDocuments === 0 &&
      figures.invoicesToDeliver === 0 &&
      figures.ordersToReceive === 0 &&
      figures.stockAlerts === 0
    );
  });

  protected formatDate = formatDate;
  protected formatMoney = formatMoney;
  protected formatQuantity = formatQuantity;
  protected formatSignedQuantity = formatSignedQuantity;
  protected formatDateTime = formatDateTime;
  protected movementTypeLabel = (type: StockMovement['type']) => MOVEMENT_TYPE_LABELS[type];
  protected retraitLabel = (status: Invoice['deliveryStatus']) => RETRAIT_LABELS[status];
  protected retraitTone = (status: Invoice['deliveryStatus']): BadgeTone =>
    status === 'FULLY_DELIVERED' ? 'neutral' : status === 'PARTIALLY_DELIVERED' ? 'accent' : 'muted';

  /** How full the alert bar reads, capped at 100 % once stock is back above threshold. */
  protected alertRatio = (stock: AgencyStock) => Math.min(100, Math.round((stock.availableQuantity / stock.alertThreshold) * 100));

  private request?: Subscription;
  private stockAlertsRequest?: Subscription;
  private movementsRequest?: Subscription;
  private invoicesRequest?: Subscription;
  private dayClosingRequest?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      // The own agency stays shown: only the choice of another one is missing.
      next: agencies => this.agencies.set(agencies),
      error: () => this.agencies.set([]),
    });
    this.load();
  }

  load(): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.stockAlertsRequest?.unsubscribe();
    this.movementsRequest?.unsubscribe();
    this.invoicesRequest?.unsubscribe();
    this.dayClosingRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    const agencyId = this.agencyId();

    this.request = this.service.getForAgency(agencyId).subscribe({
      next: figures => {
        this.figures.set(figures);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });

    this.stockAlertsRequest = this.stockService.getAlerts(agencyId).subscribe({
      next: alerts => this.stockAlerts.set(alerts.slice(0, RECENT_COUNT)),
      error: () => this.stockAlerts.set([]),
    });

    this.movementsRequest = this.stockService.getMovements(agencyId, { size: RECENT_COUNT }).subscribe({
      next: page => this.recentMovements.set(page.content),
      error: () => this.recentMovements.set([]),
    });

    this.invoicesRequest = this.invoicesService.getByAgency(agencyId).subscribe({
      next: page => this.recentInvoices.set(page.content.slice(0, RECENT_COUNT)),
      error: () => this.recentInvoices.set([]),
    });

    this.loadDayClosing(agencyId);
  }

  /** Seul un rôle qui tient la caisse déclenche cet appel : un vendeur n'a pas le droit de le faire. */
  private loadDayClosing(agencyId: string): void {
    if (!this.canOpenDayClosing()) {
      this.currentDayClosing.set(null);
      return;
    }

    this.dayClosingLoading.set(true);
    this.dayClosingRequest = this.dayClosingService.getCurrent(agencyId).subscribe({
      next: dayClosing => {
        this.currentDayClosing.set(dayClosing);
        this.dayClosingLoading.set(false);
      },
      error: () => {
        // 404 (aucune caisse ouverte) comme tout autre échec : la bannière propose d'en ouvrir une.
        // Un vrai problème réseau ne doit pas bloquer le reste du tableau de bord pour autant.
        this.currentDayClosing.set(null);
        this.dayClosingLoading.set(false);
      },
    });
  }

  onAgencySelected(option: SelectOption | null): void {
    if (!option) return;
    this.agencyId.set(option.id);
    this.load();
  }

  openDayClosingDrawer(): void {
    this.showOpenDrawer.set(true);
  }

  closeDayClosingDrawer(): void {
    this.showOpenDrawer.set(false);
  }

  onDayClosingOpened(dayClosing: DayClosing): void {
    this.currentDayClosing.set(dayClosing);
    this.showOpenDrawer.set(false);
  }
}
