import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { ProfitabilityReport } from '../../core/models/profitability.model';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate, formatNumber } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { PeriodPreset, presetRange } from './period-presets';
import { ProfitabilityService } from './profitability.service';

/** Owner screen: revenue − FIFO purchase cost = margin, margin − dated charges = net profit. */
@Component({
  selector: 'app-profitability',
  imports: [RouterLink, PageHeaderComponent, SelectSearchComponent, StateViewComponent],
  templateUrl: './profitability.component.html',
  styleUrl: './profitability.component.css',
})
export class ProfitabilityComponent implements OnInit {
  private service = inject(ProfitabilityService);
  private agenciesService = inject(AgenciesService);

  readonly presets: { id: PeriodPreset; label: string }[] = [
    { id: 'today', label: 'Aujourd’hui' },
    { id: 'yesterday', label: 'Hier' },
    { id: 'week', label: 'Cette semaine' },
    { id: 'month', label: 'Ce mois' },
  ];

  agencies = signal<Agency[]>([]);
  report = signal<ProfitabilityReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  preset = signal<PeriodPreset | null>('month');
  from = signal(presetRange('month', new Date()).from);
  to = signal(presetRange('month', new Date()).to);
  agencyFilter = signal('');

  expandedFamilies = signal<ReadonlySet<string>>(new Set());
  collapsedExpenseBlocks = signal<ReadonlySet<string>>(new Set());
  missingListOpen = signal(false);

  exporting = signal(false);
  exportMenuOpen = signal(false);
  exportError = signal<string | null>(null);

  agencyOptions = computed<SelectOption[]>(() => this.agencies().map(a => ({ id: a.id, label: a.label })));
  agencyLabel = computed(() => this.agencies().find(a => a.id === this.agencyFilter())?.label ?? '');

  /** Tracking never started: the owner must do the initial takeover first. */
  notStarted = computed(() => {
    const r = this.report();
    return !!r && r.beforeStart && r.trackingStartedAt === null;
  });
  startedAfterPeriod = computed(() => {
    const r = this.report();
    return !!r && r.beforeStart && r.trackingStartedAt !== null;
  });

  /**
   * Tracking started inside the period: margin only runs from the start, expenses cover the
   * whole period (the computation is not changed, the owner is told).
   */
  partialStartNotice = computed(() => {
    const r = this.report();
    const startedAt = r?.trackingStartedAt;
    if (!r || !startedAt || r.beforeStart || startedAt.slice(0, 19) <= `${r.from}T00:00:00`) return null;
    const time = startedAt.slice(11, 16);
    return `Marge calculée à partir du ${formatDate(startedAt)} à ${time} (démarrage du suivi des coûts) ; `
      + 'les dépenses couvrent toute la période.';
  });

  /** Lines under the families, in the order of the mockup. */
  extraLines = computed(() => {
    const r = this.report();
    if (!r) return [];
    const lines: { label: string; revenue: number | null; cost: number | null; margin: number }[] = [
      { label: 'Transport facturé', revenue: r.transportBilled, cost: null, margin: r.transportBilled },
      {
        label: 'Annulations de la période',
        revenue: 0 - r.cancelledRevenue,
        cost: 0 - r.cancelledCost,
        margin: r.cancelledCost - r.cancelledRevenue,
      },
      { label: 'Pertes sur transferts', revenue: null, cost: null, margin: 0 - r.transferLosses },
      { label: 'Écarts d’inventaire (net)', revenue: null, cost: null, margin: r.inventoryGains - r.inventoryLosses },
    ];
    return lines;
  });

  protected formatMoney = formatMoney;
  protected formatDate = formatDate;
  protected formatNumber = formatNumber;

  private request?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      error: (error: ApiError) => this.error.set(error.message),
    });
    this.load();
  }

  load(): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.service.get(this.from(), this.to(), this.agencyFilter() || undefined).subscribe({
      next: report => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  selectPreset(preset: PeriodPreset): void {
    const range = presetRange(preset, new Date());
    this.preset.set(preset);
    this.from.set(range.from);
    this.to.set(range.to);
    this.load();
  }

  onDateChange(which: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    (which === 'from' ? this.from : this.to).set(value);
    this.preset.set(null);
    if (this.from() <= this.to()) this.load();
    else this.error.set('La date de début doit précéder la date de fin.');
  }

  onAgencySelected(option: SelectOption | null): void {
    this.agencyFilter.set(option?.id ?? '');
    this.load();
  }

  toggleFamily(familyId: string): void {
    this.expandedFamilies.update(s => this.toggled(s, familyId));
  }

  toggleExpenseBlock(key: string): void {
    this.collapsedExpenseBlocks.update(s => this.toggled(s, key));
  }

  toggleMissingList(): void {
    this.missingListOpen.update(open => !open);
  }

  toggleExportMenu(): void {
    this.exportMenuOpen.update(open => !open);
  }

  exportReport(format: 'pdf' | 'xlsx'): void {
    this.exportMenuOpen.set(false);
    this.exporting.set(true);
    this.exportError.set(null);
    this.service.download(format, this.from(), this.to(), this.agencyFilter() || undefined).subscribe({
      next: ({ blob, filename }) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        // Revoking synchronously cancels the download on mobile Safari.
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
      error: (error: ApiError) => {
        this.exporting.set(false);
        this.exportError.set(error.message);
      },
    });
  }

  /** "28,5 %" from a fraction; "—" when the rate is undefined. */
  formatRate(rate: number | null): string {
    return rate === null ? '—' : `${(rate * 100).toFixed(1).replace('.', ',')} %`;
  }

  private toggled(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  }
}
