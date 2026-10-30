import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { CostingStatus, InitialCostLine } from '../../core/models/costing.model';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatQuantity } from '../stock/stock-format';
import { CostingService } from './costing.service';

/** Owner screen: starts the FIFO cost tracking, then fills in the unit cost of each opening lot. */
@Component({
  selector: 'app-initial-costs',
  imports: [PageHeaderComponent, SearchBarComponent, SelectSearchComponent, StateViewComponent, ConfirmDialogComponent],
  templateUrl: './initial-costs.component.html',
  styleUrl: './initial-costs.component.css',
})
export class InitialCostsComponent implements OnInit {
  private service = inject(CostingService);
  private agenciesService = inject(AgenciesService);

  status = signal<CostingStatus | null>(null);
  agencies = signal<Agency[]>([]);
  loadingStatus = signal(true);
  statusError = signal<string | null>(null);
  confirmingStart = signal(false);
  starting = signal(false);
  startError = signal<string | null>(null);

  /** All lines of the agency / search, filtered on the client so that the progress counter has its total. */
  allLines = signal<InitialCostLine[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  agencyFilter = signal('');
  search = signal('');
  missingOnly = signal(true);

  /** Lines saved since the last load stay visible under the "Sans coût" filter, with their ✓. */
  private justSaved = signal<ReadonlySet<string>>(new Set());
  rowErrors = signal<Record<string, string>>({});
  saving = signal<ReadonlySet<string>>(new Set());

  agencyOptions = computed<SelectOption[]>(() => this.agencies().map(a => ({ id: a.id, label: a.label })));
  agencyLabel = computed(() => this.agencies().find(a => a.id === this.agencyFilter())?.label ?? '');

  /** Lines shown in the table. */
  lines = computed(() =>
    this.missingOnly()
      ? this.allLines().filter(l => l.unitCost === null || this.justSaved().has(l.lotId))
      : this.allLines(),
  );
  total = computed(() => this.allLines().length);
  missing = computed(() => this.allLines().filter(l => l.unitCost === null).length);
  filled = computed(() => this.total() - this.missing());

  startedLabel = computed(() => {
    const s = this.status();
    if (!s?.started || !s.startedAt) return '';
    return `Suivi démarré le ${formatDate(s.startedAt)} à ${s.startedAt.slice(11, 16)} par ${s.startedByName ?? '—'}`;
  });

  protected formatQuantity = formatQuantity;

  private request?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      error: (error: ApiError) => this.error.set(error.message),
    });
    this.loadStatus();
  }

  loadStatus(): void {
    this.loadingStatus.set(true);
    this.statusError.set(null);
    this.service.status().subscribe({
      next: status => {
        this.status.set(status);
        this.loadingStatus.set(false);
        if (status.started) this.loadLines();
      },
      error: (error: ApiError) => {
        this.statusError.set(error.message);
        this.loadingStatus.set(false);
      },
    });
  }

  askStart(): void {
    this.confirmingStart.set(true);
  }

  cancelStart(): void {
    this.confirmingStart.set(false);
  }

  confirmStart(): void {
    this.confirmingStart.set(false);
    this.starting.set(true);
    this.startError.set(null);
    this.service.start().subscribe({
      next: status => {
        this.starting.set(false);
        this.status.set(status);
        this.loadLines();
      },
      error: (error: ApiError) => {
        this.starting.set(false);
        this.startError.set(error.message);
      },
    });
  }

  loadLines(): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.service
      .initialLots({
        agencyId: this.agencyFilter() || undefined,
        missingOnly: false,
        search: this.search() || undefined,
      })
      .subscribe({
        next: lines => {
          this.allLines.set(lines);
          this.justSaved.set(new Set());
          this.rowErrors.set({});
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.error.set(error.message);
          this.loading.set(false);
        },
      });
  }

  onAgencySelected(option: SelectOption | null): void {
    this.agencyFilter.set(option?.id ?? '');
    this.loadLines();
  }

  onSearch(term: string): void {
    this.search.set(term);
    this.loadLines();
  }

  toggleMissingOnly(event: Event): void {
    this.missingOnly.set((event.target as HTMLInputElement).checked);
  }

  /** Saves the typed cost of one line; an untouched or unchanged input does nothing. */
  saveCost(line: InitialCostLine, raw: string): void {
    const text = raw.trim();
    if (text === '' && line.unitCost === null) return;
    const value = Number(text.replace(',', '.'));
    if (text === '' || Number.isNaN(value) || value < 0) {
      this.setRowError(line.lotId, 'Saisissez un coût supérieur ou égal à 0.');
      return;
    }
    if (value === line.unitCost) return;

    this.setRowError(line.lotId, null);
    this.saving.update(s => new Set(s).add(line.lotId));
    this.service.setInitialCost(line.lotId, value).subscribe({
      next: saved => {
        this.allLines.update(lines => lines.map(l => (l.lotId === saved.lotId ? saved : l)));
        this.justSaved.update(s => new Set(s).add(saved.lotId));
        this.endSaving(line.lotId);
      },
      error: (error: ApiError) => {
        this.setRowError(line.lotId, error.message);
        this.endSaving(line.lotId);
      },
    });
  }

  private endSaving(lotId: string): void {
    this.saving.update(s => {
      const next = new Set(s);
      next.delete(lotId);
      return next;
    });
  }

  private setRowError(lotId: string, message: string | null): void {
    this.rowErrors.update(errors => {
      const next = { ...errors };
      if (message) next[lotId] = message;
      else delete next[lotId];
      return next;
    });
  }
}
