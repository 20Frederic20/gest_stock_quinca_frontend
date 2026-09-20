import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { AgencyContextService } from '../../core/agency/agency-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { ArticleMovementStats, MOVEMENT_TYPE_LABELS, StockMovement } from '../../core/models/stock.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { formatNumber } from '../articles/article-format';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { formatDateTime, formatQuantity, formatSignedQuantity, todayIso } from '../stock/stock-format';
import { StockService } from '../stock/stock.service';
import { MovementDetailComponent } from './movement-detail.component';
import { ReversalFormComponent } from './reversal-form.component';

type DrawerMode = 'detail' | 'reversal';
type Tab = 'stats' | 'list';

/**
 * Stock > Mouvements: the daily report. Lands on the per-article summary of the period
 * (stats tab); clicking an article drills into its movements (list tab, same period).
 */
@Component({
  selector: 'app-movement-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    DrawerComponent,
    MovementDetailComponent,
    ReversalFormComponent,
  ],
  templateUrl: './movement-list.component.html',
  styleUrl: './movement-list.component.css',
})
export class MovementListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(StockService);
  private articlesService = inject(ArticlesService);
  agencyContext = inject(AgencyContextService);

  agencyOptions = this.agencyContext.agencyOptions;
  /** The agency whose movements are shown: shared with the navbar switcher, so either can change it. */
  agencyId = this.agencyContext.viewedAgencyId;
  agencyLabel = this.agencyContext.viewedAgencyLabel;
  articleFilter = signal<SelectOption | null>(null);

  /** Everyone may look at another agency's stock, from here or the navbar. */
  canChooseAgency = computed(() => this.auth.can('stock.viewAll'));
  /** Reversal: in one's own agency for a manager, anywhere for an administrator. */
  canAct = computed(() => this.auth.can('stock.act', this.agencyId()));

  tab = signal<Tab>('stats');
  /** "yyyy-MM-dd". Alone, dateFrom means that single day; both mean the whole period. */
  dateFrom = signal(todayIso());
  dateTo = signal('');

  movements = signal<StockMovement[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);

  stats = signal<ArticleMovementStats[]>([]);
  statsLoading = signal(false);
  statsError = signal<string | null>(null);

  /** Movements cancelled by a reversal visible on this page. A reversal on another page is only known by the backend. */
  private reversedIds = computed(
    () => new Set(this.movements().map(m => m.reversedMovementId).filter((id): id is string => id !== null)),
  );

  emptyMessage = computed(() =>
    this.articleFilter() ? 'Aucun mouvement pour cet article sur cette période.' : 'Aucun mouvement sur cette période.',
  );
  statsEmptyMessage = 'Aucun article n’a bougé sur cette période.';

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  selectedMovement = signal<StockMovement | null>(null);
  drawerHeading = computed(() => (this.drawerMode() === 'reversal' ? 'Annuler un mouvement' : 'Mouvement de stock'));

  /** Handed to the select-search, which calls it on every pause in typing. */
  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  protected typeLabels = MOVEMENT_TYPE_LABELS;
  protected formatDateTime = formatDateTime;
  protected formatQuantity = formatQuantity;
  protected formatNumber = formatNumber;
  protected formatSignedQuantity = formatSignedQuantity;

  private request?: Subscription;
  private statsRequest?: Subscription;
  /** So a change this page made itself isn't reloaded a second time by the effect below. */
  private knownAgencyId: string;

  constructor() {
    // Settles the agency (back to the user's own the first time) before anything reads it.
    this.agencyContext.ensureLoaded();
    this.knownAgencyId = this.agencyId();

    // Catches a change made elsewhere, e.g. the navbar switcher, while this page is open.
    effect(() => {
      const id = this.agencyId();
      if (id === this.knownAgencyId) return;
      this.knownAgencyId = id;
      untracked(() => this.reloadActiveTab(0));
    });
  }

  ngOnInit(): void {
    this.loadStats();
  }

  /** Switches tab, loading it the first time (or after a filter change) since it's shown. */
  showTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'stats') this.loadStats();
    else this.load(0);
  }

  private reloadActiveTab(page = 0): void {
    if (this.tab() === 'stats') this.loadStats();
    else this.load(page);
  }

  load(page = 0): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service
      .getMovements(this.agencyId(), {
        articleId: this.articleFilter()?.id,
        startDate: this.dateFrom(),
        endDate: this.dateTo() || undefined,
        page,
      })
      .subscribe({
        next: response => {
          this.movements.set(response.content);
          this.pageInfo.set(toPageInfo(response));
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.error.set(error.message);
          this.loading.set(false);
        },
      });
  }

  loadStats(): void {
    this.statsRequest?.unsubscribe();
    this.statsLoading.set(true);
    this.statsError.set(null);

    this.statsRequest = this.service
      .getMovementStats(this.agencyId(), { startDate: this.dateFrom(), endDate: this.dateTo() || undefined })
      .subscribe({
        next: rows => {
          this.stats.set(rows);
          this.statsLoading.set(false);
        },
        error: (error: ApiError) => {
          this.statsError.set(error.message);
          this.statsLoading.set(false);
        },
      });
  }

  onAgencySelected(option: SelectOption | null): void {
    if (!option) return;
    this.knownAgencyId = option.id;
    this.agencyContext.select(option.id);
    this.closeDrawer();
    this.notice.set(null);
    this.reloadActiveTab(0);
  }

  onArticleFilter(option: SelectOption | null): void {
    this.articleFilter.set(option);
    this.load(0);
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    // The period can't end before it starts: widening dateFrom past dateTo drops dateTo instead of erroring.
    if (this.dateTo() && this.dateTo() < value) this.dateTo.set('');
    this.reloadActiveTab(0);
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.reloadActiveTab(0);
  }

  /** Back to today, no article, no end date — same defaults as landing on the page. */
  resetFilters(): void {
    this.articleFilter.set(null);
    this.dateFrom.set(todayIso());
    this.dateTo.set('');
    this.reloadActiveTab(0);
  }

  /** A row of the stats tab: drills into that article's movements, same agency and period. */
  openArticleStats(row: ArticleMovementStats): void {
    this.articleFilter.set({ id: row.articleId, label: `${row.articleCode} — ${row.articleDesignation}` });
    this.tab.set('list');
    this.load(0);
  }

  isReversed(movement: StockMovement): boolean {
    return this.reversedIds().has(movement.id);
  }

  /** "Inventaire du 15/09/2026 08:27 : +8 400 (Ciment CIM II 32.5R)". */
  summary(movement: StockMovement): string {
    return `${MOVEMENT_TYPE_LABELS[movement.type]} du ${formatDateTime(movement.movementDate)} : `
      + `${formatSignedQuantity(movement.quantity, '')} (${movement.articleDesignation})`;
  }

  openDetail(movement: StockMovement): void {
    this.selectedMovement.set(movement);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openReversal(): void {
    this.drawerMode.set('reversal');
  }

  onReversalCancelled(): void {
    this.drawerMode.set('detail');
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedMovement.set(null);
  }

  /** The reversal is the newest movement: back to the first page, where it shows up. */
  onReversed(): void {
    this.closeDrawer();
    this.notice.set('Mouvement annulé.');
    this.load(0);
  }
}
