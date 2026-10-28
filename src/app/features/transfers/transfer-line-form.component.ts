import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { TransferLineRequest } from '../../core/models/transfer.model';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { searchArticleOptions } from '../articles/article-options';
import { ArticlesService } from '../articles/articles.service';

/**
 * Composes one line of a transfer: the article and how much of it, in its own stock unit. Unlike a
 * purchase order there is no packaging and no price — a transfer only moves what is already owned.
 */
@Component({
  selector: 'app-transfer-line-form',
  imports: [ReactiveFormsModule, SelectSearchComponent],
  templateUrl: './transfer-line-form.component.html',
  styleUrl: './transfer-line-form.component.css',
})
export class TransferLineFormComponent {
  private fb = inject(FormBuilder);
  private articlesService = inject(ArticlesService);

  /** True while the parent saves the previous line: no second one is composed meanwhile. */
  busy = input(false);

  composed = output<TransferLineRequest>();

  article = signal<SelectOption | null>(null);
  formError = signal<string | null>(null);

  // Same rules as TransferLineRequest on the backend.
  form = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
  });

  canAdd = computed(() => this.article() !== null && !this.busy());

  searchArticles = (term: string): Observable<SelectOption[]> => searchArticleOptions(this.articlesService, term);

  onArticleSelected(option: SelectOption | null): void {
    this.article.set(option);
    this.formError.set(null);
  }

  submit(): void {
    const article = this.article();
    if (!article) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('La quantité doit être strictement positive.');
      return;
    }

    this.formError.set(null);
    const { quantity } = this.form.getRawValue();
    this.composed.emit({ articleId: article.id, quantity });

    // Ready for the next article.
    this.onArticleSelected(null);
    this.form.reset({ quantity: 1 });
  }
}
