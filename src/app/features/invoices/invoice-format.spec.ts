import { CustomerCredit } from '../../core/models/customer.model';
import { Invoice, InvoiceLine } from '../../core/models/invoice.model';
import { creditOverrun, isCancellable, lineNetAmount, stockNeedsByArticle, stockQuantity } from './invoice-format';

const validated = {
  status: 'VALIDATED', paidAmount: 0, deliveryStatus: 'NOT_DELIVERED',
} as Invoice;
const credit = { remainingCredit: 50000, creditLimit: 200000, currentBalance: 150000 } as CustomerCredit;

describe('invoice format', () => {
  it('converts a line quantity into stock units', () => {
    expect(stockQuantity(3, 50)).toBe(150);
    expect(stockQuantity(0.5, 0.3)).toBe(0.15);
  });

  it('estimates the amount before VAT, discount deducted', () => {
    expect(lineNetAmount(3, 5000, 0)).toBe(15000);
    expect(lineNetAmount(3, 5000, 10)).toBe(13500);
  });

  it('adds up what the whole document takes from the stock, article by article', () => {
    const lines = [
      { articleId: 'a1', designation: 'Ciment', quantity: 3, appliedCoefficient: 50 },
      { articleId: 'a2', designation: 'Fer à béton', quantity: 4, appliedCoefficient: 1 },
      { articleId: 'a1', designation: 'Ciment', quantity: 2, appliedCoefficient: 50 },
    ] as InvoiceLine[];

    expect(stockNeedsByArticle(lines)).toEqual([
      { articleId: 'a1', designation: 'Ciment', needed: 250 },
      { articleId: 'a2', designation: 'Fer à béton', needed: 4 },
    ]);
  });

  it('measures how far a credit sale goes past what the customer may still owe', () => {
    expect(creditOverrun({ ...validated, creditMode: true, totalAmount: 59000 }, credit)).toBe(9000);
    expect(creditOverrun({ ...validated, creditMode: true, totalAmount: 50000 }, credit)).toBe(0);
  });

  it('never reports an overrun on a cash sale, whatever its amount', () => {
    expect(creditOverrun({ ...validated, creditMode: false, totalAmount: 900000 }, credit)).toBe(0);
  });

  it('allows cancelling only an untouched validated document', () => {
    expect(isCancellable(validated)).toBe(true);
    expect(isCancellable({ ...validated, status: 'DRAFT' })).toBe(false);
    expect(isCancellable({ ...validated, status: 'CANCELLED' })).toBe(false);
    expect(isCancellable({ ...validated, paidAmount: 1000 })).toBe(false);
    expect(isCancellable({ ...validated, deliveryStatus: 'PARTIALLY_DELIVERED' })).toBe(false);
  });
});
