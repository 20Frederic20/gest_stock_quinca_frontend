import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ApiError } from '../../core/http/api-error.model';
import { ArticlePrice } from '../../core/models/article-price.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDate } from '../articles/article-format';
import { PRICE_STATUS_LABELS, PRICE_STATUS_TONES, formatMoney, priceStatus, todayIso } from './price-rules';
import { PricesService } from './prices.service';

/**
 * Sheet of a price, with the history of its privilege for the same packaging.
 * Only a price that has not started offers its actions; the list decides what they do.
 */
@Component({
  selector: 'app-price-detail',
  imports: [BadgeComponent],
  templateUrl: './price-detail.component.html',
  styleUrl: './price-detail.component.css',
})
export class PriceDetailComponent {
  private service = inject(PricesService);

  price = input.required<ArticlePrice>();
  /** Injected so that tests do not depend on the day they run. */
  today = input(todayIso());

  edit = output<void>();
  delete = output<void>();

  history = signal<ArticlePrice[]>([]);
  historyLoading = signal(false);
  historyError = signal<string | null>(null);

  status = computed(() => priceStatus(this.price(), this.history(), this.today()));

  historyRows = computed(() =>
    [...this.history()]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(price => ({ price, status: priceStatus(price, this.history(), this.today()) })),
  );

  protected formatDate = formatDate;
  protected formatMoney = formatMoney;
  protected statusLabels = PRICE_STATUS_LABELS;
  protected statusTones = PRICE_STATUS_TONES;

  constructor() {
    effect(onCleanup => {
      const price = this.price();
      this.historyLoading.set(true);
      this.historyError.set(null);

      const subscription = this.service.getHistory(price.packagingId, price.privilegeId).subscribe({
        next: history => {
          this.history.set(history);
          this.historyLoading.set(false);
        },
        error: (error: ApiError) => {
          this.history.set([]);
          this.historyError.set(error.message);
          this.historyLoading.set(false);
        },
      });
      // Another price shown before the answer: that answer is no longer wanted.
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
