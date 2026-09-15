import { Component, effect, inject, input, output, signal } from '@angular/core';
import { ApiError } from '../../core/http/api-error.model';
import { AgencyStock, MOVEMENT_TYPE_LABELS, StockMovement } from '../../core/models/stock.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDateTime, formatQuantity, formatSignedQuantity } from './stock-format';
import { StockService } from './stock.service';

const RECENT_MOVEMENTS = 10;

/** Sheet of a stock line: quantities, spread across agencies and latest movements. */
@Component({
  selector: 'app-stock-detail',
  imports: [BadgeComponent],
  templateUrl: './stock-detail.component.html',
  styleUrl: './stock-detail.component.css',
})
export class StockDetailComponent {
  private service = inject(StockService);

  stock = input.required<AgencyStock>();
  /** Inventory counts are only offered to users allowed to act on this agency. */
  canAct = input(false);
  count = output<void>();

  spread = signal<AgencyStock[]>([]);
  spreadError = signal<string | null>(null);
  movements = signal<StockMovement[]>([]);
  movementsError = signal<string | null>(null);

  protected typeLabels = MOVEMENT_TYPE_LABELS;
  protected formatQuantity = formatQuantity;
  protected formatSignedQuantity = formatSignedQuantity;
  protected formatDateTime = formatDateTime;

  constructor() {
    effect(onCleanup => {
      const stock = this.stock();
      this.spreadError.set(null);
      this.movementsError.set(null);

      const spread = this.service.getByArticle(stock.articleId).subscribe({
        next: lines => this.spread.set(lines),
        error: (error: ApiError) => {
          this.spread.set([]);
          this.spreadError.set(error.message);
        },
      });
      const movements = this.service
        .getMovements(stock.agencyId, { articleId: stock.articleId, page: 0, size: RECENT_MOVEMENTS })
        .subscribe({
          next: page => this.movements.set(page.content),
          error: (error: ApiError) => {
            this.movements.set([]);
            this.movementsError.set(error.message);
          },
        });

      // Another line shown before the answers: they are no longer wanted.
      onCleanup(() => {
        spread.unsubscribe();
        movements.unsubscribe();
      });
    });
  }
}
