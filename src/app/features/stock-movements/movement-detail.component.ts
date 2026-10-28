import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MOVEMENT_TYPE_LABELS, StockMovement } from '../../core/models/stock.model';
import { ArticlesService } from '../articles/articles.service';
import { ReceptionsService } from '../purchases/receptions.service';
import { formatDateTime, formatQuantity, formatSignedQuantity } from '../stock/stock-format';

/** Sheet of a stock movement, with the reversal action when it is still possible. */
@Component({
  selector: 'app-movement-detail',
  templateUrl: './movement-detail.component.html',
  styleUrl: './movement-detail.component.css',
})
export class MovementDetailComponent {
  private articlesService = inject(ArticlesService);
  private receptionsService = inject(ReceptionsService);
  private router = inject(Router);

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

  /**
   * A movement's documentType/documentId point at the piece that caused it, but not every type
   * has a page reachable from just its id yet: TRANSFER does; RECEIPT does through its order;
   * DELIVERY has no by-id endpoint today (only by-invoice/by-agency), so it stays plain text.
   * ponytail: DELIVERY left unclickable, add a `GET /deliveries/{id}` on the backend to close it.
   */
  documentClickable = computed(() => {
    const type = this.movement().documentType;
    return type === 'TRANSFER' || type === 'RECEIPT';
  });

  navigatingDocument = signal(false);

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

  /** Opens the piece behind this movement: a transfer directly, a reception through its order. */
  goToDocument(): void {
    const { documentType, documentId } = this.movement();
    if (!documentId) return;

    if (documentType === 'TRANSFER') {
      this.router.navigate(['/transfers', documentId]);
      return;
    }

    if (documentType === 'RECEIPT') {
      this.navigatingDocument.set(true);
      this.receptionsService.getById(documentId).subscribe({
        next: reception => this.router.navigate(['/purchase-orders', reception.purchaseOrderId]),
        // The order behind an old or cancelled reception may no longer resolve: fail quietly, stay on the sheet.
        error: () => this.navigatingDocument.set(false),
      });
    }
  }
}
