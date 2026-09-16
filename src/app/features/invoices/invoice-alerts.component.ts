import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { CustomerCredit } from '../../core/models/customer.model';
import { Invoice } from '../../core/models/invoice.model';
import { formatMoney } from '../pricing/price-rules';
import { formatQuantity } from '../stock/stock-format';
import { StockService } from '../stock/stock.service';
import { creditOverrun, stockNeedsByArticle } from './invoice-format';

/** One article of the draft that the agency cannot cover. */
interface Shortage {
  articleId: string;
  designation: string;
  needed: number;
  available: number;
  unitCode: string;
}

/**
 * What the backend will refuse at validation, said before the seller gets there: the credit limit of the
 * customer and the stock of the agency of the document. Both are checked again by the backend, which decides.
 */
@Component({
  selector: 'app-invoice-alerts',
  imports: [],
  templateUrl: './invoice-alerts.component.html',
  styleUrl: './invoice-alerts.component.css',
})
export class InvoiceAlertsComponent {
  private stockService = inject(StockService);

  invoice = input.required<Invoice>();
  /** Null while the credit situation of the customer is unknown: nothing is claimed then. */
  credit = input<CustomerCredit | null>(null);

  shortages = signal<Shortage[]>([]);

  overrun = computed(() => {
    const credit = this.credit();
    return credit ? creditOverrun(this.invoice(), credit) : 0;
  });

  protected formatMoney = formatMoney;
  protected formatQuantity = formatQuantity;

  private requests: Subscription[] = [];

  constructor() {
    // Every change of the document (a line added, a quantity changed) asks the stock again.
    effect(() => {
      const invoice = this.invoice();
      untracked(() => this.checkStock(invoice));
    });
  }

  private checkStock(invoice: Invoice): void {
    // Answers about the previous state of the document must not land on the new one.
    this.requests.forEach(request => request.unsubscribe());
    this.requests = [];
    this.shortages.set([]);

    // A quote or a proforma reserves nothing: there is nothing to warn about.
    if (invoice.type !== 'INVOICE') return;

    for (const need of stockNeedsByArticle(invoice.lines)) {
      const request = this.stockService.getOne(invoice.agencyId, need.articleId).subscribe({
        next: stock => {
          if (need.needed > stock.availableQuantity) {
            this.addShortage({ ...need, available: stock.availableQuantity, unitCode: stock.stockUnitCode });
          }
        },
        // 404 = the article never moved in this agency: nothing to sell. Other failures stay silent.
        error: (error: ApiError) => {
          if (error.status === 404) this.addShortage({ ...need, available: 0, unitCode: '' });
        },
      });
      this.requests.push(request);
    }
  }

  private addShortage(shortage: Shortage): void {
    this.shortages.update(shortages => [...shortages, shortage]);
  }
}
