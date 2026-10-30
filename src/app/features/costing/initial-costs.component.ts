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
import { Packaging } from '../../core/models/packaging.model';
import { PackagingsService } from '../packagings/packagings.service';
import { formatQuantity } from '../stock/stock-format';
import { CostingService } from './costing.service';
import {
  CostUnitOption,
  conversionText,
  costPerStockUnit,
  costUnitOptions,
  defaultCostUnitId,
  priceForPackaging,
} from './packaging-cost';

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
  private packagingsService = inject(PackagingsService);

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

  /** Packagings per article, loaded once each; an article whose load failed keeps an empty list (base unit only). */
  private packagings = signal<Record<string, Packaging[]>>({});
  private packagingsRequested = new Set<string>();
  /** Packaging picked by the user per lot; absent = the article's default. */
  private chosenUnit = signal<Record<string, string>>({});
  /** Text being typed per lot, to show its conversion before it is saved. */
  private typed = signal<Record<string, string>>({});

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
          this.typed.set({});
          this.justSaved.set(new Set());
          this.rowErrors.set({});
          this.loading.set(false);
          this.ensurePackagings();
        },
        error: (error: ApiError) => {
          this.error.set(error.message);
          this.loading.set(false);
        },
      });
  }

  /** Asks the packagings of the displayed articles, once per article. */
  private ensurePackagings(): void {
    for (const { articleId } of this.lines()) {
      if (this.packagingsRequested.has(articleId)) continue;
      this.packagingsRequested.add(articleId);
      this.packagingsService.getByArticle(articleId).subscribe({
        next: list => this.packagings.update(m => ({ ...m, [articleId]: list })),
        // The cost can still be typed per stock unit.
        error: () => this.packagings.update(m => ({ ...m, [articleId]: [] })),
      });
    }
  }

  unitOptions(line: InitialCostLine): CostUnitOption[] {
    return costUnitOptions(this.packagings()[line.articleId] ?? [], line.stockUnit);
  }

  selectedUnit(line: InitialCostLine): CostUnitOption {
    const options = this.unitOptions(line);
    const id = this.chosenUnit()[line.lotId] ?? defaultCostUnitId(this.packagings()[line.articleId] ?? []);
    return options.find(o => o.id === id) ?? options[options.length - 1];
  }

  /** Stored cost (per stock unit) expressed in the selected packaging; '' when unknown. */
  displayedCost(line: InitialCostLine): number | '' {
    return line.unitCost === null ? '' : priceForPackaging(line.unitCost, this.selectedUnit(line).quantity);
  }

  /** "4 000 F CFA le sac de 50 KG = 80 F CFA par KG" for what is typed (or stored); null when there is nothing valid. */
  conversion(line: InitialCostLine): string | null {
    const text = this.typed()[line.lotId];
    const price = text === undefined ? this.displayedCost(line) : this.parse(text);
    if (price === '' || price === null || price < 0) return null;
    return conversionText(price, this.selectedUnit(line), line.stockUnit);
  }

  /** The packagings of the article are known (loaded or failed): the default selection is then final. */
  unitsReady(line: InitialCostLine): boolean {
    return this.packagings()[line.articleId] !== undefined;
  }

  /** What the input shows: the unsaved text if any, else the stored cost in the selected packaging. */
  inputValue(line: InitialCostLine): string | number {
    return this.typed()[line.lotId] ?? this.displayedCost(line);
  }

  onUnitChange(line: InitialCostLine, unitId: string): void {
    const before = this.selectedUnit(line).quantity;
    this.chosenUnit.update(m => ({ ...m, [line.lotId]: unitId }));
    const text = this.typed()[line.lotId];
    const price = text === undefined ? null : this.parse(text);
    if (price !== null) {
      // An unsaved price keeps its meaning: same cost per stock unit, expressed in the new packaging.
      this.onTyping(line, String(priceForPackaging(price / before, this.selectedUnit(line).quantity)));
    } else if (text === undefined || text.trim() === '') {
      // The shown value follows the stored cost again.
      this.onTyping(line, undefined);
    }
  }

  onTyping(line: InitialCostLine, text: string | undefined): void {
    this.typed.update(m => {
      const next = { ...m };
      if (text === undefined) delete next[line.lotId];
      else next[line.lotId] = text;
      return next;
    });
  }

  private parse(text: string): number | null {
    const trimmed = text.trim();
    if (trimmed === '') return null;
    const value = Number(trimmed.replace(',', '.'));
    return Number.isNaN(value) ? null : value;
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
    this.ensurePackagings();
  }

  /** Saves the price typed for the selected packaging, as a cost per stock unit; an untouched or unchanged input does nothing. */
  saveCost(line: InitialCostLine, raw: string): void {
    const text = raw.trim();
    if (text === '' && line.unitCost === null) return;
    const value = Number(text.replace(',', '.'));
    if (text === '' || Number.isNaN(value) || value < 0) {
      this.setRowError(line.lotId, 'Saisissez un coût supérieur ou égal à 0.');
      return;
    }
    const unitCost = costPerStockUnit(value, this.selectedUnit(line).quantity);
    if (unitCost === line.unitCost) return;

    this.setRowError(line.lotId, null);
    this.saving.update(s => new Set(s).add(line.lotId));
    this.service.setInitialCost(line.lotId, unitCost).subscribe({
      next: saved => {
        this.allLines.update(lines => lines.map(l => (l.lotId === saved.lotId ? saved : l)));
        this.justSaved.update(s => new Set(s).add(saved.lotId));
        this.onTyping(line, undefined);
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
