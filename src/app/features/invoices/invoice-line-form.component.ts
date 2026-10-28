import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription, map } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Article } from '../../core/models/article.model';
import { PendingLine } from '../../core/models/invoice.model';
import { Packaging } from '../../core/models/packaging.model';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { formatNumber } from '../articles/article-format';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { PackagingsService } from '../packagings/packagings.service';
import { formatMoney } from '../pricing/price-rules';
import { PricesService } from '../pricing/prices.service';
import { formatQuantity } from '../stock/stock-format';
import { StockService } from '../stock/stock.service';
import { lineNetAmount, stockQuantity } from './invoice-format';

/**
 * Composes one line: the article, its packaging, the quantity and the discount. It saves nothing —
 * it hands the line over, and whoever asked for it decides when it reaches the backend. The price and
 * the stock shown are only a preview: the backend sets the real price and checks the stock at validation.
 */
@Component({
  selector: 'app-invoice-line-form',
  imports: [ReactiveFormsModule, SelectSearchComponent],
  templateUrl: './invoice-line-form.component.html',
  styleUrl: './invoice-line-form.component.css',
})
export class InvoiceLineFormComponent {
  private fb = inject(FormBuilder);
  private articlesService = inject(ArticlesService);
  private packagingsService = inject(PackagingsService);
  private pricesService = inject(PricesService);
  private stockService = inject(StockService);

  /** The customer's price grid. */
  privilegeId = input.required<string>();
  agencyId = input.required<string>();
  /** Only a final invoice reserves stock: quotes and proformas need no availability check. */
  checkStock = input(true);
  /** True while the parent is saving the previous line: no second one is composed meanwhile. */
  busy = input(false);

  composed = output<PendingLine>();

  article = signal<SelectOption | null>(null);
  /** The chosen article itself: its VAT rate and its code belong to the composed line. */
  chosen = signal<Article | null>(null);
  packagings = signal<Packaging[]>([]);
  packaging = signal<Packaging | null>(null);
  /** The price grid's price for this packaging: shown as the floor, never sent as-is if the seller raises it. */
  unitPrice = signal<number | null>(null);
  /** What is actually typed in the price field, seeded from `unitPrice` and freely raisable from there. */
  effectivePrice = signal<number | null>(null);
  /** Why no price can be shown (no packaging, no price in the grid…). */
  priceMessage = signal<string | null>(null);
  /**
   * Set when the backend had no price in the customer's own grid and fell back to the
   * default grid: holds that grid's label so the seller sees where the price actually
   * comes from, instead of believing it is the customer's negotiated price.
   */
  priceFromDefaultGrid = signal<string | null>(null);
  /** Available stock in the agency, in the article's stock unit; null while unknown. */
  available = signal<number | null>(null);
  stockUnitCode = signal('');

  formError = signal<string | null>(null);

  // Same rules as InvoiceLineRequest on the backend.
  form = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    discountRate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  private value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  packagingOptions = computed<SelectOption[]>(() =>
    this.packagings().map(packaging => ({ id: packaging.id, label: this.packagingLabel(packaging) })),
  );

  /** What the line takes from the stock. */
  needed = computed(() => {
    const packaging = this.packaging();
    const quantity = this.value().quantity;
    return packaging && quantity ? stockQuantity(quantity, packaging.quantity) : 0;
  });

  shortage = computed(() => {
    const available = this.available();
    return this.checkStock() && available !== null && this.needed() > available;
  });

  estimate = computed(() => {
    const price = this.effectivePrice();
    const { quantity, discountRate } = this.value();
    return price === null || !quantity ? null : lineNetAmount(quantity, price, discountRate ?? 0);
  });

  /** Without a price the backend would refuse the line anyway. */
  canAdd = computed(() => this.packaging() !== null && this.effectivePrice() !== null && this.chosen() !== null && !this.busy());

  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  /** "Sac de 50 KG". */
  packagingLabel = (packaging: Packaging): string =>
    `${packaging.unitLabel} de ${formatQuantity(packaging.quantity, this.stockUnitCode())}`;

  protected formatMoney = formatMoney;
  protected formatNumber = formatNumber;
  protected formatQuantity = formatQuantity;

  private packagingsRequest?: Subscription;
  private articleRequest?: Subscription;
  private stockRequest?: Subscription;
  private priceRequest?: Subscription;

  onArticleSelected(option: SelectOption | null): void {
    // Answers about the previous article must not land on the new one.
    this.packagingsRequest?.unsubscribe();
    this.articleRequest?.unsubscribe();
    this.stockRequest?.unsubscribe();
    this.priceRequest?.unsubscribe();
    this.article.set(option);
    this.chosen.set(null);
    this.packagings.set([]);
    this.packaging.set(null);
    this.unitPrice.set(null);
    this.effectivePrice.set(null);
    this.priceMessage.set(null);
    this.priceFromDefaultGrid.set(null);
    this.available.set(null);
    this.stockUnitCode.set('');
    this.formError.set(null);
    if (!option) return;

    this.packagingsRequest = this.packagingsService.getByArticle(option.id).subscribe({
      next: packagings => {
        this.packagings.set(packagings);
        if (packagings.length === 0) {
          this.priceMessage.set('Cet article n’a aucun conditionnement : il ne peut pas être vendu.');
          return;
        }
        const preferred = packagings.find(p => p.defaultSale) ?? (packagings.length === 1 ? packagings[0] : null);
        if (preferred) this.choosePackaging(preferred);
      },
      error: (error: ApiError) => this.formError.set(error.message),
    });

    // The VAT rate and the code of the article: the search only hands over an id and a label.
    this.articleRequest = this.articlesService.getById(option.id).subscribe({
      next: article => this.chosen.set(article),
      error: (error: ApiError) => this.formError.set(error.message),
    });

    this.stockRequest = this.stockService.getOne(this.agencyId(), option.id).subscribe({
      next: stock => {
        this.available.set(stock.availableQuantity);
        this.stockUnitCode.set(stock.stockUnitCode);
      },
      // 404 = the article never moved in this agency: nothing to sell. Other failures leave it unknown.
      error: (error: ApiError) => this.available.set(error.status === 404 ? 0 : null),
    });
  }

  onPackagingSelected(option: SelectOption | null): void {
    const packaging = this.packagings().find(p => p.id === option?.id);
    if (packaging) this.choosePackaging(packaging);
  }

  onPriceChanged(value: string): void {
    this.effectivePrice.set(value === '' ? null : Number(value));
  }

  submit(): void {
    const packaging = this.packaging();
    const article = this.chosen();
    const floor = this.unitPrice();
    const price = this.effectivePrice();
    if (!packaging || !article || floor === null || price === null) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('La quantité doit être positive et la remise comprise entre 0 et 100 %.');
      return;
    }

    if (price < floor) {
      this.formError.set(`Le prix ne peut pas être inférieur au prix du conditionnement (${formatMoney(floor)}).`);
      return;
    }

    this.formError.set(null);
    const { quantity, discountRate } = this.form.getRawValue();

    this.composed.emit({
      articleId: article.id,
      articleCode: article.code,
      designation: article.designation,
      packagingId: packaging.id,
      unitLabel: packaging.unitLabel,
      appliedCoefficient: packaging.quantity,
      quantity,
      discountRate,
      unitPrice: price,
      vatRate: article.vatRate,
    });

    // Ready for the next article.
    this.onArticleSelected(null);
    this.form.reset({ quantity: 1, discountRate: 0 });
  }

  private choosePackaging(packaging: Packaging): void {
    this.priceRequest?.unsubscribe();
    this.packaging.set(packaging);
    this.unitPrice.set(null);
    this.effectivePrice.set(null);
    this.priceMessage.set(null);
    this.priceFromDefaultGrid.set(null);

    this.priceRequest = this.pricesService.getApplicable(packaging.id, this.privilegeId()).subscribe({
      next: price => {
        this.unitPrice.set(price.unitPrice);
        this.effectivePrice.set(price.unitPrice);
        // The customer's own grid had nothing: the backend fell back to the default one.
        const usedDefaultGrid = !!price.privilegeId && price.privilegeId !== this.privilegeId();
        this.priceFromDefaultGrid.set(usedDefaultGrid ? price.privilegeLabel : null);
      },
      error: (error: ApiError) => this.priceMessage.set(error.message),
    });
  }
}
