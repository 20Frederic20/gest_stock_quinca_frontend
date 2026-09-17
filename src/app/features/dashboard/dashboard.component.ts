import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Dashboard } from '../../core/models/dashboard.model';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { DashboardService } from './dashboard.service';

/**
 * Pilotage > Tableau de bord: what the agency did today, and what is still waiting. Every figure
 * comes from one call to the backend, which counts them in the database — nothing is added up here.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, PageHeaderComponent, SelectSearchComponent, StateViewComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(DashboardService);
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

  figures = signal<Dashboard | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

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

  private request?: Subscription;

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
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getForAgency(this.agencyId()).subscribe({
      next: figures => {
        this.figures.set(figures);
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
    this.load();
  }
}
