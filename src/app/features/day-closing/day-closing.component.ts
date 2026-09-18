import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { DayClosing } from '../../core/models/day-closing.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { DayClosingCloseFormComponent } from './day-closing-close-form.component';
import { DayClosingOpenFormComponent } from './day-closing-open-form.component';
import { DayClosingService } from './day-closing.service';

/**
 * Caisse > Clôture de journée : la session en cours de l'agence (à ouvrir ou à clôturer),
 * puis l'historique des journées passées, du plus récent au plus ancien.
 */
@Component({
  selector: 'app-day-closing',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    DrawerComponent,
    DayClosingOpenFormComponent,
    DayClosingCloseFormComponent,
  ],
  templateUrl: './day-closing.component.html',
  styleUrl: './day-closing.component.css',
})
export class DayClosingComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(DayClosingService);
  private agenciesService = inject(AgenciesService);

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

  current = signal<DayClosing | null>(null);
  currentLoading = signal(false);
  currentError = signal<string | null>(null);

  history = signal<DayClosing[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  historyLoading = signal(false);
  historyError = signal<string | null>(null);

  /** null = fermé, 'open' = déclarer le fond de caisse, 'close' = compter et clôturer. */
  drawerMode = signal<'open' | 'close' | null>(null);

  protected formatDate = formatDate;
  protected formatMoney = formatMoney;

  private currentRequest?: Subscription;
  private historyRequest?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      // The own agency stays shown: only the choice of another one is missing.
      next: agencies => this.agencies.set(agencies),
      error: () => this.agencies.set([]),
    });
    this.loadCurrent();
    this.loadHistory(0);
  }

  loadCurrent(): void {
    this.currentRequest?.unsubscribe();
    this.currentLoading.set(true);
    this.currentError.set(null);

    this.currentRequest = this.service.getCurrent(this.agencyId()).subscribe({
      next: dayClosing => {
        this.current.set(dayClosing);
        this.currentLoading.set(false);
      },
      error: (error: ApiError) => {
        // 404 : aucune journée ouverte pour l'instant, ce n'est pas une erreur à afficher.
        if (error.status === 404) {
          this.current.set(null);
        } else {
          this.currentError.set(error.message);
        }
        this.currentLoading.set(false);
      },
    });
  }

  loadHistory(page: number): void {
    this.historyRequest?.unsubscribe();
    this.historyLoading.set(true);
    this.historyError.set(null);

    this.historyRequest = this.service.getByAgency(this.agencyId(), page).subscribe({
      next: response => {
        this.history.set(response.content);
        this.pageInfo.set(toPageInfo(response));
        this.historyLoading.set(false);
      },
      error: (error: ApiError) => {
        this.historyError.set(error.message);
        this.historyLoading.set(false);
      },
    });
  }

  onAgencySelected(option: SelectOption | null): void {
    if (!option) return;
    this.agencyId.set(option.id);
    this.loadCurrent();
    this.loadHistory(0);
  }

  openDrawer(mode: 'open' | 'close'): void {
    this.drawerMode.set(mode);
  }

  closeDrawer(): void {
    this.drawerMode.set(null);
  }

  onOpened(dayClosing: DayClosing): void {
    this.current.set(dayClosing);
    this.drawerMode.set(null);
    this.loadHistory(0);
  }

  onClosed(dayClosing: DayClosing): void {
    this.current.set(null);
    this.drawerMode.set(null);
    this.history.update(history => [dayClosing, ...history]);
    this.loadHistory(0);
  }
}
