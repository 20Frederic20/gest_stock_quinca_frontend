import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { AgencyContextService } from '../../core/agency/agency-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { MOVEMENT_TYPE_LABELS, StockMovement } from '../../core/models/stock.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { formatNumber } from '../articles/article-format';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { formatDateTime, formatSignedQuantity } from '../stock/stock-format';
import { StockService } from '../stock/stock.service';
import { MovementDetailComponent } from './movement-detail.component';
import { ReversalFormComponent } from './reversal-form.component';

type DrawerMode = 'detail' | 'reversal';

/** Stock > Mouvements: the history of one agency, newest first, the user's own by default. */
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

  movements = signal<StockMovement[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);

  /** Movements cancelled by a reversal visible on this page. A reversal on another page is only known by the backend. */
  private reversedIds = computed(
    () => new Set(this.movements().map(m => m.reversedMovementId).filter((id): id is string => id !== null)),
  );

  emptyMessage = computed(() =>
    this.articleFilter() ? 'Aucun mouvement pour cet article dans cette agence.' : 'Aucun mouvement dans cette agence.',
  );

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  selectedMovement = signal<StockMovement | null>(null);
  drawerHeading = computed(() => (this.drawerMode() === 'reversal' ? 'Annuler un mouvement' : 'Mouvement de stock'));

  /** Handed to the select-search, which calls it on every pause in typing. */
  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  protected typeLabels = MOVEMENT_TYPE_LABELS;
  protected formatDateTime = formatDateTime;
  protected formatNumber = formatNumber;
  protected formatSignedQuantity = formatSignedQuantity;

  private request?: Subscription;
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
      untracked(() => this.load(0));
    });
  }

  ngOnInit(): void {
    this.load(0);
  }

  load(page = 0): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service
      .getMovements(this.agencyId(), { articleId: this.articleFilter()?.id, page })
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

  onAgencySelected(option: SelectOption | null): void {
    if (!option) return;
    this.knownAgencyId = option.id;
    this.agencyContext.select(option.id);
    this.closeDrawer();
    this.notice.set(null);
    this.load(0);
  }

  onArticleFilter(option: SelectOption | null): void {
    this.articleFilter.set(option);
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
