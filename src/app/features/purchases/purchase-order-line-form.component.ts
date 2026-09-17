import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Packaging } from '../../core/models/packaging.model';
import { PurchaseOrderLineRequest } from '../../core/models/purchase-order.model';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { formatNumber } from '../articles/article-format';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';
import { PackagingsService } from '../packagings/packagings.service';

/**
 * Composes one line of a purchase order: the article, how it is bought, how much and at what price.
 * Unlike a sale, nothing computes the price here — it is the one the supplier gives.
 */
@Component({
  selector: 'app-purchase-order-line-form',
  imports: [ReactiveFormsModule, SelectSearchComponent],
  templateUrl: './purchase-order-line-form.component.html',
  styleUrl: './purchase-order-line-form.component.css',
})
export class PurchaseOrderLineFormComponent {
  private fb = inject(FormBuilder);
  private articlesService = inject(ArticlesService);
  private packagingsService = inject(PackagingsService);

  /** True while the parent saves the previous line: no second one is composed meanwhile. */
  busy = input(false);

  composed = output<PurchaseOrderLineRequest>();

  article = signal<SelectOption | null>(null);
  packagings = signal<Packaging[]>([]);
  packaging = signal<Packaging | null>(null);
  formError = signal<string | null>(null);

  // Same rules as PurchaseOrderLineRequest on the backend.
  form = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
  });

  packagingOptions = computed<SelectOption[]>(() =>
    this.packagings().map(packaging => ({ id: packaging.id, label: this.packagingLabel(packaging) })),
  );

  canAdd = computed(() => this.packaging() !== null && !this.busy());

  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  /** "Sac de 50". The stock unit is the article's, not repeated on every row. */
  packagingLabel = (packaging: Packaging): string =>
    `${packaging.unitLabel} de ${formatNumber(packaging.quantity)}`;

  private packagingsRequest?: Subscription;

  onArticleSelected(option: SelectOption | null): void {
    // Answers about the previous article must not land on the new one.
    this.packagingsRequest?.unsubscribe();
    this.article.set(option);
    this.packagings.set([]);
    this.packaging.set(null);
    this.formError.set(null);
    if (!option) return;

    this.packagingsRequest = this.packagingsService.getByArticle(option.id).subscribe({
      next: packagings => {
        this.packagings.set(packagings);
        if (packagings.length === 0) {
          this.formError.set('Cet article n’a aucun conditionnement : il ne peut pas être commandé.');
          return;
        }
        // The one it is usually bought in, or the only one there is.
        this.packaging.set(
          packagings.find(p => p.defaultPurchase) ?? (packagings.length === 1 ? packagings[0] : null),
        );
      },
      error: (error: ApiError) => this.formError.set(error.message),
    });
  }

  onPackagingSelected(option: SelectOption | null): void {
    const packaging = this.packagings().find(p => p.id === option?.id);
    if (packaging) this.packaging.set(packaging);
  }

  submit(): void {
    const packaging = this.packaging();
    if (!packaging) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('La quantité doit être positive et le prix d’achat ne peut pas être négatif.');
      return;
    }

    this.formError.set(null);
    const { quantity, unitPrice } = this.form.getRawValue();
    this.composed.emit({ packagingId: packaging.id, quantity, unitPrice });

    // Ready for the next article.
    this.onArticleSelected(null);
    this.form.reset({ quantity: 1, unitPrice: 0 });
  }
}
