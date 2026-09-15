import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription, map } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Invoice } from '../../core/models/invoice.model';
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
import { InvoicesService } from './invoices.service';

/**
 * Adds one article to a draft. The price and the stock shown are only a preview:
 * the backend sets the real price and checks the stock when the document is validated.
 */
@Component({
  selector: 'app-invoice-line-form',
  imports: [ReactiveFormsModule, SelectSearchComponent],
  templateUrl: './invoice-line-form.component.html',
  styleUrl: './invoice-line-form.component.css',
})
export class InvoiceLineFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(InvoicesService);
  private articlesService = inject(ArticlesService);
  private packagingsService = inject(PackagingsService);
  private pricesService = inject(PricesService);
  private stockService = inject(StockService);

  invoiceId = input.required<string>();
  /** The customer's price grid. */
  privilegeId = input.required<string>();
  agencyId = input.required<string>();
  /** Only a final invoice reserves stock: quotes and proformas need no availability check. */
  checkStock = input(true);

  added = output<Invoice>();

  article = signal<SelectOption | null>(null);
  packagings = signal<Packaging[]>([]);
  packaging = signal<Packaging | null>(null);
  unitPrice = signal<number | null>(null);
  /** Why no price can be shown (no packaging, no price in the grid…). */
  priceMessage = signal<string | null>(null);
  /** Available stock in the agency, in the article's stock unit; null while unknown. */
  available = signal<number | null>(null);
  stockUnitCode = signal('');

  saving = signal(false);
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
    const price = this.unitPrice();
    const { quantity, discountRate } = this.value();
    return price === null || !quantity ? null : lineNetAmount(quantity, price, discountRate ?? 0);
  });

  /** Without a price the backend would refuse the line anyway. */
  canAdd = computed(() => this.packaging() !== null && this.unitPrice() !== null && !this.saving());

  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  /** "Sac de 50 KG". */
  packagingLabel = (packaging: Packaging): string =>
    `${packaging.unitLabel} de ${formatQuantity(packaging.quantity, this.stockUnitCode())}`;

  protected formatMoney = formatMoney;
  protected formatNumber = formatNumber;
  protected formatQuantity = formatQuantity;

  private packagingsRequest?: Subscription;
  private stockRequest?: Subscription;
  private priceRequest?: Subscription;

  onArticleSelected(option: SelectOption | null): void {
    // Answers about the previous article must not land on the new one.
    this.packagingsRequest?.unsubscribe();
    this.stockRequest?.unsubscribe();
    this.priceRequest?.unsubscribe();
    this.article.set(option);
    this.packagings.set([]);
    this.packaging.set(null);
    this.unitPrice.set(null);
    this.priceMessage.set(null);
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

  submit(): void {
    const packaging = this.packaging();
    if (!packaging) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('La quantité doit être positive et la remise comprise entre 0 et 100 %.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    this.service.addLine(this.invoiceId(), { packagingId: packaging.id, ...this.form.getRawValue() }).subscribe({
      next: invoice => {
        this.saving.set(false);
        this.added.emit(invoice);
        // Ready for the next article.
        this.onArticleSelected(null);
        this.form.reset({ quantity: 1, discountRate: 0 });
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
      },
    });
  }

  private choosePackaging(packaging: Packaging): void {
    this.priceRequest?.unsubscribe();
    this.packaging.set(packaging);
    this.unitPrice.set(null);
    this.priceMessage.set(null);

    this.priceRequest = this.pricesService.getApplicable(packaging.id, this.privilegeId()).subscribe({
      next: price => this.unitPrice.set(price.unitPrice),
      error: (error: ApiError) => this.priceMessage.set(error.message),
    });
  }
}
