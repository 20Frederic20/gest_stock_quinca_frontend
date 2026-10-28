import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { AgencyStock, StockMovement } from '../../core/models/stock.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { formatQuantity, formatSignedQuantity } from './stock-format';
import { StockService } from './stock.service';

/**
 * Inventory count of one article in one agency. The user types what was counted,
 * the backend records the difference with the current stock.
 * `stock` given = article already known; null = the article is searched first.
 */
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
      .subscribe(value => this.counted.set(value));

    // Starts again whenever another line is given while the panel stays open.
    effect(() => {
      const stock = this.stock();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({ articleId: stock?.articleId ?? '', countedQuantity: null, reason: '' });
    });
  }

  onArticleSelected(option: SelectOption | null): void {
    if (!option) return;
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
        },
      });
  }
}
