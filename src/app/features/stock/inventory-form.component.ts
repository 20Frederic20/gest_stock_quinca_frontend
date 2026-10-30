import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { AgencyStock, StockMovement } from '../../core/models/stock.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { Packaging } from '../../core/models/packaging.model';
import { CostingService } from '../costing/costing.service';
import {
  CostUnitOption,
  conversionText,
  costPerStockUnit,
  costUnitOptions,
  defaultCostUnitId,
  priceForPackaging,
} from '../costing/packaging-cost';
import { PackagingsService } from '../packagings/packagings.service';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { formatQuantity, formatSignedQuantity } from './stock-format';
import { StockService } from './stock.service';

/**
 * Inventory count of one article in one agency. The user types what was counted,
 * the backend records the difference with the current stock.
 * `stock` given = article already known; null = the article is searched first.
 */
/** Backend refusal of an increase without unit cost while cost tracking is on. */
const UNIT_COST_REQUIRED = 'Le coût unitaire est obligatoire quand on ajoute du stock';

@Component({
  selector: 'app-inventory-form',
  imports: [ReactiveFormsModule, FieldErrorComponent, SelectSearchComponent],
  templateUrl: './inventory-form.component.html',
  styleUrl: './inventory-form.component.css',
})
export class InventoryFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(StockService);
  private articlesService = inject(ArticlesService);
  private costing = inject(CostingService);
  private packagingsService = inject(PackagingsService);

  agencyId = input.required<string>();
  stock = input<AgencyStock | null>(null);
  saved = output<StockMovement>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Reset with the given line, overwritten when an article is chosen by search.
  articleLabel = linkedSignal(() => {
    const stock = this.stock();
    return stock ? `${stock.articleCode} — ${stock.articleDesignation}` : '';
  });
  /** null until known: an article chosen by search is looked up first. */
  currentQuantity = linkedSignal<number | null>(() => this.stock()?.quantity ?? null);
  unitCode = linkedSignal(() => this.stock()?.stockUnitCode ?? '');

  // Same rules as StockAdjustmentRequest on the backend.
  form = this.fb.group({
    articleId: this.fb.nonNullable.control('', [Validators.required]),
    countedQuantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    reason: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(255)]),
  });

  /** Packagings of the article the cost is asked for; empty (base unit only) until loaded or when the load fails. */
  private packagings = signal<Packaging[]>([]);
  /** Packaging picked by the user; null = the article's default purchase packaging. */
  private chosenUnit = signal<string | null>(null);
  /** The price control, as a signal, for the conversion text. */
  private typedCost = signal<number | null>(null);

  costUnitOptions = computed<CostUnitOption[]>(() => costUnitOptions(this.packagings(), this.unitCode()));
  selectedCostUnit = computed<CostUnitOption>(() => {
    const options = this.costUnitOptions();
    const id = this.chosenUnit() ?? defaultCostUnitId(this.packagings());
    return options.find(o => o.id === id) ?? options[options.length - 1];
  });
  /** "4 000 F CFA le sac de 50 KG = 80 F CFA par KG". */
  costConversion = computed(() => {
    const price = this.typedCost();
    if (price === null || Number.isNaN(price) || price < 0) return null;
    return conversionText(price, this.selectedCostUnit(), this.unitCode());
  });

  /** Price of the added stock, for the selected packaging; outside the group because it only applies to an increase. */
  unitCost = new FormControl<number | null>(null, [Validators.required, Validators.min(0)]);
  /** Cost tracking started: an increase must then carry its unit cost. */
  private tracking = signal(false);
  /** Articles whose last cost was already asked, to prefill once per article. */
  private costRequested = new Set<string>();
  /** Last cost (per stock unit) waiting for the packagings, to be shown for the selected one. */
  private pendingLastCost: number | null = null;
  /** The cost field waits for the packagings, so that its default packaging is final before anything is typed. */
  costLoading = signal(false);
  private packagingsLoaded = false;
  private lastCostLoaded = false;

  /** The typed count as a signal, so that the difference follows the keyboard. */
  private counted = signal<number | null>(null);

  difference = computed(() => {
    const counted = this.counted();
    const current = this.currentQuantity();
    if (counted === null || current === null || Number.isNaN(counted)) return null;
    // Rounded like the backend column (4 decimals): 0.3 − 0.1 must not show 0.19999999999999998.
    return Math.round((counted - current) * 10000) / 10000;
  });

  differenceLabel = computed(() => {
    const difference = this.difference();
    return difference === null ? null : formatSignedQuantity(difference, this.unitCode());
  });

  showUnitCost = computed(() => {
    const difference = this.difference();
    return this.tracking() && difference !== null && difference > 0;
  });

  addedLabel = computed(() => formatQuantity(this.difference() ?? 0, this.unitCode()));

  currentLabel = computed(() => {
    const current = this.currentQuantity();
    return current === null ? null : formatQuantity(current, this.unitCode());
  });

  /** Handed to the select-search, which calls it on every pause in typing. */
  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  private lookup?: Subscription;

  constructor() {
    this.form.controls.countedQuantity.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.counted.set(value);
        this.prefillUnitCost();
      });

    // Status is readable by the owner and managers; when it fails, the form behaves as without tracking.
    this.unitCost.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => this.typedCost.set(value));

    this.costing.status().subscribe({
      next: status => {
        this.tracking.set(status.started);
        this.prefillUnitCost();
      },
      error: () => undefined,
    });

    // Starts again whenever another line is given while the panel stays open.
    effect(() => {
      const stock = this.stock();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({ articleId: stock?.articleId ?? '', countedQuantity: null, reason: '' });
      this.resetCost();
    });
  }

  /** Once an increase is typed, proposes the last known cost of the article (never over what the user typed). */
  private prefillUnitCost(): void {
    const articleId = this.form.controls.articleId.value;
    if (!this.showUnitCost() || !articleId || this.costRequested.has(articleId)) return;
    this.costRequested.add(articleId);
    this.packagingsLoaded = false;
    this.lastCostLoaded = false;
    this.pendingLastCost = null;
    this.costLoading.set(true);
    this.unitCost.disable({ emitEvent: false });
    const current = () => this.form.controls.articleId.value === articleId;

    this.packagingsService.getByArticle(articleId).subscribe({
      next: list => {
        if (current()) this.packagings.set(list);
      },
      // The cost can still be typed per stock unit.
      error: () => undefined,
    }).add(() => {
      this.packagingsLoaded = true;
      if (current()) {
        this.costLoading.set(false);
        this.unitCost.enable({ emitEvent: false });
        this.applyLastCost();
      }
    });
    this.costing.lastCost(this.agencyId(), articleId).subscribe({
      next: ({ unitCost }) => (this.pendingLastCost = unitCost),
      // Only a suggestion: the user can still type the cost.
      error: () => undefined,
    }).add(() => {
      this.lastCostLoaded = true;
      if (current()) this.applyLastCost();
    });
  }

  /** Once both answers are in, proposes the last cost in the selected packaging (never over what the user typed). */
  private applyLastCost(): void {
    if (!this.packagingsLoaded || !this.lastCostLoaded) return;
    if (this.pendingLastCost !== null && this.unitCost.value === null) {
      this.unitCost.setValue(priceForPackaging(this.pendingLastCost, this.selectedCostUnit().quantity));
    }
  }

  /** Re-expresses the shown price in the new packaging: the cost per stock unit stays the same. */
  onCostUnitChange(unitId: string): void {
    const before = this.selectedCostUnit().quantity;
    this.chosenUnit.set(unitId);
    const price = this.unitCost.value;
    if (price !== null && !Number.isNaN(price)) {
      const after = this.selectedCostUnit().quantity;
      this.unitCost.setValue(priceForPackaging(price / before, after));
    }
  }

  private resetCost(): void {
    this.unitCost.enable({ emitEvent: false });
    this.unitCost.reset(null);
    this.costLoading.set(false);
    this.costRequested.clear();
    this.packagings.set([]);
    this.chosenUnit.set(null);
    this.pendingLastCost = null;
  }

  onArticleSelected(option: SelectOption | null): void {
    if (!option) return;
    this.resetCost();
    this.form.controls.articleId.setValue(option.id);
    this.form.controls.articleId.markAsTouched();
    this.articleLabel.set(option.label);
    this.currentQuantity.set(null);
    this.formError.set(null);

    this.lookup?.unsubscribe();
    this.lookup = this.service.getOne(this.agencyId(), option.id).subscribe({
      next: stock => {
        this.currentQuantity.set(stock.quantity);
        this.unitCode.set(stock.stockUnitCode);
      },
      error: (error: ApiError) => {
        // Never moved in this agency: the count starts from zero, and the unit comes from the article.
        if (error.status === 404) {
          this.currentQuantity.set(0);
          this.unitCode.set('');
          this.lookup = this.articlesService.getById(option.id).subscribe({
            next: article => this.unitCode.set(article.stockUnitCode),
            // Only the unit next to the quantities is missing: not worth an error message.
            error: () => undefined,
          });
        } else {
          this.formError.set(error.message);
        }
      },
    });
  }

  submit(): void {
    const withCost = this.showUnitCost();
    if (withCost && this.costLoading()) return;
    if (this.form.invalid || (withCost && this.unitCost.invalid)) {
      this.form.markAllAsTouched();
      this.unitCost.markAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    const value = this.form.getRawValue();
    this.service
      .adjust(this.agencyId(), {
        articleId: value.articleId,
        countedQuantity: value.countedQuantity!,
        reason: value.reason.trim(),
        ...(withCost ? { unitCost: costPerStockUnit(this.unitCost.value!, this.selectedCostUnit().quantity) } : {}),
      })
      .subscribe({
        next: movement => {
          this.saving.set(false);
          this.saved.emit(movement);
        },
        error: (error: ApiError) => {
          this.saving.set(false);
          this.formError.set(error.message);
          this.fieldErrors.set(error.fieldErrors);
          // The status call may have failed: the backend tells us tracking is on, so ask for the cost.
          if (error.status === 400 && error.message === UNIT_COST_REQUIRED && !this.tracking()) {
            this.tracking.set(true);
            this.unitCost.markAsTouched();
            this.prefillUnitCost();
          }
        },
      });
  }
}
