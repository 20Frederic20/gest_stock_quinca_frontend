import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Article } from '../../core/models/article.model';
import { Family } from '../../core/models/family.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { FamiliesService } from '../families/families.service';
import { buildFamilyTree } from '../families/family-tree';
import { UnitsOfMeasureService } from '../units-of-measure/units-of-measure.service';
import { ArticleDetailComponent } from './article-detail.component';
import { ArticleFormComponent } from './article-form.component';
import { formatNumber, rateToPercent } from './article-format';
import { ArticlesService } from './articles.service';

type DrawerMode = 'detail' | 'form';

@Component({
  selector: 'app-article-list',
  imports: [
    PageHeaderComponent,
    SearchBarComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    ArticleDetailComponent,
    ArticleFormComponent,
  ],
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.css',
})
export class ArticleListComponent implements OnInit {
  private service = inject(ArticlesService);
  private familiesService = inject(FamiliesService);
  private unitsService = inject(UnitsOfMeasureService);
  private auth = inject(AuthService);

  /** Read-only users see the screen without its write actions. */
  canWrite = computed(() => this.auth.can('referential.write'));

  articles = signal<Article[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (status change, deletion…): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  /** Reference lists for the selects, loaded once. */
  families = signal<Family[]>([]);
  units = signal<UnitOfMeasure[]>([]);

  term = signal('');
  familyFilter = signal<SelectOption | null>(null);
  /** The backend has no endpoint combining both: the search then covers every family. */
  searchIgnoresFamily = computed(() => this.term() !== '' && this.familyFilter() !== null);

  familyOptions = computed<SelectOption[]>(() =>
    buildFamilyTree(this.families()).map(row => ({ id: row.family.id, label: row.family.label })),
  );

  emptyMessage = computed(() =>
    this.term() || this.familyFilter()
      ? 'Aucun article ne correspond à cette recherche.'
      : 'Aucun article enregistré.',
  );

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while creating a new article. */
  selectedArticle = signal<Article | null>(null);
  drawerHeading = computed(() => {
    const article = this.selectedArticle();
    if (this.drawerMode() === 'detail') return article?.designation ?? '';
    return article ? 'Modifier l’article' : 'Nouvel article';
  });

  /** The confirmation box is open while this is not null. */
  articleToDelete = signal<Article | null>(null);
  deleteMessage = computed(
    () => `L’article « ${this.articleToDelete()?.designation ?? ''} » sera définitivement supprimé.`,
  );

  protected formatNumber = formatNumber;
  protected rateToPercent = rateToPercent;

  private listRequest?: Subscription;

  ngOnInit(): void {
    this.familiesService.getAll().subscribe({
      next: families => this.families.set(families),
      error: (error: ApiError) => this.actionError.set(`Familles indisponibles : ${error.message}`),
    });
    this.unitsService.getAll().subscribe({
      next: units => this.units.set(units),
      error: (error: ApiError) => this.actionError.set(`Unités de mesure indisponibles : ${error.message}`),
    });
    this.load(0);
  }

  /** Picks the endpoint from the active filters: search first, then family, otherwise everything. */
  load(page: number): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    const term = this.term();
    const familyId = this.familyFilter()?.id;
    const request = term
      ? this.service.search(term, page)
      : familyId
        ? this.service.getByFamily(familyId, page)
        : this.service.getAll(page);

    this.listRequest = request.subscribe({
      next: response => {
        this.articles.set(response.content);
        this.pageInfo.set(toPageInfo(response));
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  reload(): void {
    this.load(this.pageInfo()?.page ?? 0);
  }

  onSearch(term: string): void {
    this.term.set(term);
    this.load(0);
  }

  onFamilyFilter(option: SelectOption | null): void {
    this.familyFilter.set(option);
    this.load(0);
  }

  openDetail(article: Article): void {
    this.selectedArticle.set(article);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openCreate(): void {
    this.selectedArticle.set(null);
    this.drawerMode.set('form');
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    this.drawerMode.set('form');
  }

  /** Cancelling an edit goes back to the sheet; cancelling a creation closes the panel. */
  onFormCancelled(): void {
    if (this.selectedArticle()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedArticle.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.reload();
  }

  /** No confirmation: the action is reversible. */
  toggleActive(): void {
    const article = this.selectedArticle();
    if (!article) return;

    this.actionError.set(null);
    const request = article.active
      ? this.service.deactivate(article.id)
      : this.service.activate(article.id);

    request.subscribe({
      next: updated => {
        this.selectedArticle.set(updated);
        // Updated in place: reloading would only move the page under the user's eyes.
        this.articles.update(list => list.map(a => (a.id === updated.id ? updated : a)));
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(): void {
    this.articleToDelete.set(this.selectedArticle());
  }

  cancelDelete(): void {
    this.articleToDelete.set(null);
  }

  confirmDelete(): void {
    const article = this.articleToDelete();
    if (!article) return;

    this.articleToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(article.id).subscribe({
      next: () => {
        this.closeDrawer();
        // The last article of a page is gone: that page no longer exists.
        const info = this.pageInfo();
        const page = info && info.page > 0 && this.articles().length === 1 ? info.page - 1 : (info?.page ?? 0);
        this.load(page);
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
