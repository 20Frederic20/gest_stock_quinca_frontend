import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MOVEMENT_TYPE_LABELS, StockMovement } from '../../core/models/stock.model';
import { ArticlesService } from '../articles/articles.service';
import { formatDateTime, formatQuantity, formatSignedQuantity } from '../stock/stock-format';

/** Sheet of a stock movement, with the reversal action when it is still possible. */
@Component({
  selector: 'app-movement-detail',
  templateUrl: './movement-detail.component.html',
  styleUrl: './movement-detail.component.css',
})
export class MovementDetailComponent {
  private articlesService = inject(ArticlesService);

  movement = input.required<StockMovement>();
  /** The user may act on this agency's stock. */
  canReverse = input(false);
  /** Its reversal is known, e.g. seen on the same page of the history. */
  alreadyReversed = input(false);
  reverse = output<void>();

  /** The movement does not carry it: read on the article. Empty if it cannot be read. */
  unitCode = signal('');

  /** The backend refuses to cancel a reversal, or a movement twice. */
  reversible = computed(
    () => this.canReverse() && this.movement().type !== 'REVERSAL' && !this.alreadyReversed(),
  );

  protected typeLabels = MOVEMENT_TYPE_LABELS;
  protected formatDateTime = formatDateTime;
  protected formatQuantity = formatQuantity;
  protected formatSignedQuantity = formatSignedQuantity;

  constructor() {
    effect(onCleanup => {
      const articleId = this.movement().articleId;
      this.unitCode.set('');
      const subscription = this.articlesService.getById(articleId).subscribe({
        next: article => this.unitCode.set(article.stockUnitCode),
        // Only the unit next to the quantities is missing: not worth an error message.
        error: () => this.unitCode.set(''),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
