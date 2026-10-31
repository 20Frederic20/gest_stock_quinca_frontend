import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Expense, ExpenseCategory } from '../../core/models/expense.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney, todayIso } from '../pricing/price-rules';
import { ExpenseCategoriesComponent } from './expense-categories.component';
import { ExpenseCategoriesService } from './expense-categories.service';
import { COMMON_OPTION_ID, ExpenseFormComponent } from './expense-form.component';
import { ExpensesService } from './expenses.service';

const PAGE_SIZE = 20;

/** First and last day of the month of `today`, as ISO dates. */
export function monthRange(today: string): { from: string; to: string } {
  const [year, month] = today.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

/** Analyse > Dépenses: dated charges, plus the category management tab for the owner. */
@Component({
  selector: 'app-expense-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    BadgeComponent,
    ExpenseFormComponent,
    ExpenseCategoriesComponent,
  ],
  templateUrl: './expense-list.component.html',
  styleUrl: './expense-list.component.css',
})
export class ExpenseListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(ExpensesService);
  private categoriesService = inject(ExpenseCategoriesService);
  private agenciesService = inject(AgenciesService);

  canManageCategories = computed(() => this.auth.can('expenses.categories'));
  /** The owner picks any agency; a manager is fixed to his own. */
  canChooseAgency = computed(() => this.auth.can('expenses.common'));

  tab = signal<'expenses' | 'categories'>('expenses');

  agencies = signal<Agency[]>([]);
  categories = signal<ExpenseCategory[]>([]);
  activeCategories = computed(() => this.categories().filter(c => c.active));

  private initialRange = monthRange(todayIso());
  from = signal(this.initialRange.from);
  to = signal(this.initialRange.to);
  /** '' = all agencies, COMMON_OPTION_ID = common charges only. */
  agencyFilter = signal(this.auth.can('expenses.common') ? '' : (this.auth.user()?.agencyId ?? ''));
  categoryFilter = signal('');

  agencyOptions = computed<SelectOption[]>(() => [
    { id: COMMON_OPTION_ID, label: 'Commune (sans agence)' },
    ...this.agencies().map(a => ({ id: a.id, label: a.label })),
  ]);
  categoryOptions = computed<SelectOption[]>(() => this.categories().map(c => ({ id: c.id, label: c.label })));
  agencyLabel = computed(() => {
    const id = this.agencyFilter();
    if (id === COMMON_OPTION_ID) return 'Commune (sans agence)';
    return this.agencies().find(a => a.id === id)?.label ?? this.auth.user()?.agencyLabel ?? '';
  });
  categoryLabel = computed(() => this.categories().find(c => c.id === this.categoryFilter())?.label ?? '');

  expenses = signal<Expense[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  actionError = signal<string | null>(null);
  /** Failure to load the agencies or categories lists. */
  lookupError = signal<string | null>(null);

  drawerOpen = signal(false);
  /** null while creating. */
  selected = signal<Expense | null>(null);
  toDelete = signal<Expense | null>(null);
  deleteMessage = computed(() => {
    const e = this.toDelete();
    return e ? `La charge « ${e.label} » (${formatMoney(e.amount)}) sera définitivement supprimée.` : '';
  });

  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

  private request?: Subscription;

  ngOnInit(): void {
    this.loadLookups();
    this.load(0);
  }

  /** Agencies and categories feed the filters and the form: a failure is shown, with a retry. */
  loadLookups(): void {
    this.lookupError.set(null);
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      error: (error: ApiError) => this.lookupError.set(error.message),
    });
    this.loadCategories();
  }

  private loadCategories(): void {
    this.categoriesService.getAll(false).subscribe({
      next: categories => this.categories.set(categories),
      error: (error: ApiError) => this.lookupError.set(error.message),
    });
  }

  load(page: number): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    const agency = this.agencyFilter();
    this.request = this.service
      .search({
        from: this.from() || undefined,
        to: this.to() || undefined,
        agencyId: agency && agency !== COMMON_OPTION_ID ? agency : undefined,
        common: agency === COMMON_OPTION_ID ? true : undefined,
        categoryId: this.categoryFilter() || undefined,
        page,
        size: PAGE_SIZE,
      })
      .subscribe({
        next: response => {
          this.expenses.set(response.content);
          this.pageInfo.set(toPageInfo(response));
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.error.set(error.message);
          this.loading.set(false);
        },
      });
  }

  onDateChange(which: 'from' | 'to', event: Event): void {
    (which === 'from' ? this.from : this.to).set((event.target as HTMLInputElement).value);
    this.load(0);
  }

  onAgencySelected(option: SelectOption | null): void {
    this.agencyFilter.set(option?.id ?? '');
    this.load(0);
  }

  onCategorySelected(option: SelectOption | null): void {
    this.categoryFilter.set(option?.id ?? '');
    this.load(0);
  }

  showTab(tab: 'expenses' | 'categories'): void {
    this.tab.set(tab);
    // Categories may have been renamed or (de)activated in the other tab.
    if (tab === 'expenses') {
      this.loadCategories();
    }
  }

  openCreate(): void {
    this.selected.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(expense: Expense): void {
    this.selected.set(expense);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selected.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load(this.pageInfo()?.page ?? 0);
  }

  askDelete(expense: Expense): void {
    this.toDelete.set(expense);
  }

  cancelDelete(): void {
    this.toDelete.set(null);
  }

  confirmDelete(): void {
    const expense = this.toDelete();
    if (!expense) return;
    this.toDelete.set(null);
    this.actionError.set(null);

    this.service.delete(expense.id).subscribe({
      next: () => this.load(this.pageInfo()?.page ?? 0),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
