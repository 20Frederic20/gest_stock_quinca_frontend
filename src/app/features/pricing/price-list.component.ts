import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Article } from '../../core/models/article.model';
import { ArticlePrice } from '../../core/models/article-price.model';
import { Packaging } from '../../core/models/packaging.model';
import { Privilege } from '../../core/models/privilege.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { formatDate, formatNumber } from '../articles/article-format';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { PackagingsService } from '../packagings/packagings.service';
import { PriceDetailComponent } from './price-detail.component';
import { PriceFormComponent } from './price-form.component';
import { PRICE_STATUS_LABELS, PRICE_STATUS_TONES, formatMoney, priceStatus, todayIso } from './price-rules';
import { PricesService } from './prices.service';
import { PrivilegesService } from './privileges.service';

type DrawerMode = 'detail' | 'form';

/**
 * "Prix" section of the pricing screen. The backend only lists prices per packaging,
 * and packagings per article: the section starts with both choices, one after the other.
 */
@Component({
  selector: 'app-price-list',
  imports: [
    SelectSearchComponent,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    PriceDetailComponent,
    PriceFormComponent,
  ],
  templateUrl: './price-list.component.html',
  styleUrl: './price-list.component.css',
})
export class PriceListComponent implements OnInit {
  private service = inject(PricesService);
  private articlesService = inject(ArticlesService);
  private packagingsService = inject(PackagingsService);
  private privilegesService = inject(PrivilegesService);
  private auth = inject(AuthService);

  /** Read-only users see the section without its write actions. */
  canWrite = computed(() => this.auth.can('referential.write'));

  today = signal(todayIso());
  privileges = signal<Privilege[]>([]);

  selectedArticle = signal<SelectOption | null>(null);
  /** Loaded alongside the packagings, only to know the stock unit. */
  private article = signal<Article | null>(null);
  stockUnitCode = computed(() => this.article()?.stockUnitCode ?? '');

  packagings = signal<Packaging[]>([]);
  selectedPackaging = signal<Packaging | null>(null);
  packagingOptions = computed<SelectOption[]>(() =>
    this.packagings().map(packaging => ({ id: packaging.id, label: this.describe(packaging) })),
  );

  prices = signal<ArticlePrice[]>([]);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (deletion…): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  /** Grouped by privilege, newest start date first within each. */
  rows = computed(() =>
    [...this.prices()]
      .sort((a, b) => a.privilegeLabel.localeCompare(b.privilegeLabel) || b.startDate.localeCompare(a.startDate))
      .map(price => ({ price, status: priceStatus(price, this.prices(), this.today()) })),
  );

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while creating a new price. */
  selectedPrice = signal<ArticlePrice | null>(null);
  drawerHeading = computed(() => {
    if (this.drawerMode() === 'detail') return 'Prix';
    return this.selectedPrice() ? 'Modifier le prix' : 'Nouveau prix';
  });

  /** The confirmation box is open while this is not null. */
  priceToDelete = signal<ArticlePrice | null>(null);
  deleteMessage = computed(() => {
    const price = this.priceToDelete();
    if (!price) return '';
    return `Le prix de ${formatMoney(price.unitPrice)} (grille ${price.privilegeLabel}, à partir du `
      + `${formatDate(price.startDate)}) sera définitivement supprimé.`;
  });

  /** Handed to the select-search, which calls it on every pause in typing. */
  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  protected formatDate = formatDate;
  protected formatMoney = formatMoney;
  protected statusLabels = PRICE_STATUS_LABELS;
  protected statusTones = PRICE_STATUS_TONES;

  private articleRequest?: Subscription;
  private packagingsRequest?: Subscription;
  private pricesRequest?: Subscription;

  ngOnInit(): void {
    this.privilegesService.getAll().subscribe({
      next: privileges => this.privileges.set(privileges),
      error: (error: ApiError) => this.actionError.set(`Privilèges indisponibles : ${error.message}`),
    });
  }

  onArticleSelected(option: SelectOption | null): void {
    this.selectedArticle.set(option);
    this.article.set(null);
    this.packagings.set([]);
    this.selectPackaging(null);
    // Answers about the previous article must not land on the new one.
    this.articleRequest?.unsubscribe();
    this.packagingsRequest?.unsubscribe();
    if (!option) return;

    this.packagingsRequest = this.packagingsService.getByArticle(option.id).subscribe({
      next: packagings => {
        this.packagings.set(packagings);
        // Nothing to choose from: save the user a click.
        if (packagings.length === 1) this.selectPackaging(packagings[0]);
      },
      error: (error: ApiError) => this.error.set(error.message),
    });
    this.articleRequest = this.articlesService.getById(option.id).subscribe({
      next: article => this.article.set(article),
      // Only the unit in the packaging labels is missing: not worth an error message.
      error: () => this.article.set(null),
    });
  }

  onPackagingSelected(option: SelectOption | null): void {
    this.selectPackaging(this.packagings().find(p => p.id === option?.id) ?? null);
  }

  load(): void {
    const packaging = this.selectedPackaging();
    if (!packaging) return;

    this.pricesRequest?.unsubscribe();
    this.today.set(todayIso());
    this.loading.set(true);
    this.error.set(null);

    this.pricesRequest = this.service.getByPackaging(packaging.id).subscribe({
      next: prices => {
        this.prices.set(prices);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (!this.selectedPackaging()) return;
    this.selectedPrice.set(null);
    this.drawerMode.set('form');
    this.drawerOpen.set(true);
  }

  openDetail(price: ArticlePrice): void {
    this.selectedPrice.set(price);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    this.drawerMode.set('form');
  }

  /** Cancelling an edit goes back to the sheet; cancelling a creation closes the panel. */
  onFormCancelled(): void {
    if (this.selectedPrice()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedPrice.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load();
  }

  askDelete(): void {
    this.priceToDelete.set(this.selectedPrice());
  }

  cancelDelete(): void {
    this.priceToDelete.set(null);
  }

  confirmDelete(): void {
    const price = this.priceToDelete();
    if (!price) return;

    this.priceToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(price.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  private selectPackaging(packaging: Packaging | null): void {
    this.selectedPackaging.set(packaging);
    this.closeDrawer();
    this.prices.set([]);
    this.error.set(null);
    this.pricesRequest?.unsubscribe();
    if (packaging) this.load();
  }

  /** "SAC de 50 KG". */
  private describe(packaging: Packaging): string {
    return `${packaging.unitCode} de ${formatNumber(packaging.quantity)} ${this.stockUnitCode()}`.trim();
  }
}
