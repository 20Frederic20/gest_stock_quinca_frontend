import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Article } from '../../core/models/article.model';
import { Packaging } from '../../core/models/packaging.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { formatNumber } from '../articles/article-format';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { UnitsOfMeasureService } from '../units-of-measure/units-of-measure.service';
import { PackagingDetailComponent } from './packaging-detail.component';
import { PackagingFormComponent } from './packaging-form.component';
import { PackagingsService } from './packagings.service';

type DrawerMode = 'detail' | 'form';

/**
 * The backend only lists packagings per article: the screen starts by choosing one.
 */
@Component({
  selector: 'app-packaging-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    PackagingDetailComponent,
    PackagingFormComponent,
  ],
  templateUrl: './packaging-list.component.html',
  styleUrl: './packaging-list.component.css',
})
export class PackagingListComponent implements OnInit {
  private service = inject(PackagingsService);
  private articlesService = inject(ArticlesService);
  private unitsService = inject(UnitsOfMeasureService);

  /** The option picked in the article select; null until the user chooses. */
  selectedArticle = signal<SelectOption | null>(null);
  /** Loaded alongside the packagings, only to know the stock unit. */
  private article = signal<Article | null>(null);
  stockUnitCode = computed(() => this.article()?.stockUnitCode ?? '');

  packagings = signal<Packaging[]>([]);
  units = signal<UnitOfMeasure[]>([]);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (default flag, deletion…): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while creating a new packaging. */
  selectedPackaging = signal<Packaging | null>(null);
  drawerHeading = computed(() => {
    const packaging = this.selectedPackaging();
    if (this.drawerMode() === 'detail') return packaging ? this.describe(packaging) : '';
    return packaging ? 'Modifier le conditionnement' : 'Nouveau conditionnement';
  });

  /** The confirmation box is open while this is not null. */
  packagingToDelete = signal<Packaging | null>(null);
  deleteMessage = computed(() => {
    const packaging = this.packagingToDelete();
    return `Le conditionnement « ${packaging ? this.describe(packaging) : ''} » sera définitivement supprimé.`;
  });

  /** Handed to the select-search, which calls it on every pause in typing. */
  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  protected formatNumber = formatNumber;

  private packagingsRequest?: Subscription;
  private articleRequest?: Subscription;

  ngOnInit(): void {
    this.unitsService.getAll().subscribe({
      next: units => this.units.set(units),
      error: (error: ApiError) => this.actionError.set(`Unités de mesure indisponibles : ${error.message}`),
    });
  }

  onArticleSelected(option: SelectOption | null): void {
    this.selectedArticle.set(option);
    this.closeDrawer();
    this.packagings.set([]);
    this.article.set(null);
    this.actionError.set(null);
    // Answers about the previous article must not land on the new one.
    this.articleRequest?.unsubscribe();
    this.packagingsRequest?.unsubscribe();
    if (!option) return;

    this.load();
    this.articleRequest = this.articlesService.getById(option.id).subscribe({
      next: article => this.article.set(article),
      // Only the unit next to the quantities is missing: not worth an error message.
      error: () => this.article.set(null),
    });
  }

  load(): void {
    const article = this.selectedArticle();
    if (!article) return;

    this.packagingsRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.packagingsRequest = this.service.getByArticle(article.id).subscribe({
      next: packagings => {
        this.packagings.set(packagings);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    if (!this.selectedArticle()) return;
    this.selectedPackaging.set(null);
    this.drawerMode.set('form');
    this.drawerOpen.set(true);
  }

  openDetail(packaging: Packaging): void {
    this.selectedPackaging.set(packaging);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    this.drawerMode.set('form');
  }

  /** Cancelling an edit goes back to the sheet; cancelling a creation closes the panel. */
  onFormCancelled(): void {
    if (this.selectedPackaging()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedPackaging.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load();
  }

  setDefaultPurchase(): void {
    this.changeDefault(id => this.service.setDefaultPurchase(id));
  }

  setDefaultSale(): void {
    this.changeDefault(id => this.service.setDefaultSale(id));
  }

  askDelete(): void {
    this.packagingToDelete.set(this.selectedPackaging());
  }

  cancelDelete(): void {
    this.packagingToDelete.set(null);
  }

  confirmDelete(): void {
    const packaging = this.packagingToDelete();
    if (!packaging) return;

    this.packagingToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(packaging.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  /** "SAC de 50 KG". */
  private describe(packaging: Packaging): string {
    return `${packaging.unitCode} de ${formatNumber(packaging.quantity)} ${this.stockUnitCode()}`.trim();
  }

  private changeDefault(request: (id: string) => Observable<Packaging>): void {
    const packaging = this.selectedPackaging();
    if (!packaging) return;

    this.actionError.set(null);
    request(packaging.id).subscribe({
      next: updated => {
        this.selectedPackaging.set(updated);
        // The backend removed the flag from another packaging: only a reload shows it.
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
