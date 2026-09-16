import { CustomerCredit } from '../../core/models/customer.model';
import { Invoice, InvoiceLine, PendingLine } from '../../core/models/invoice.model';
import {
  creditOverrun,
  isCancellable,
  lineNetAmount,
  previewTotals,
  stockNeedsByArticle,
  stockQuantity,
  toLineRequest,
} from './invoice-format';

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
    expect(creditOverrun(true, 59000, credit)).toBe(9000);
    expect(creditOverrun(true, 50000, credit)).toBe(0);
  });

  it('never reports an overrun on a cash sale, whatever its amount', () => {
    expect(creditOverrun(false, 900000, credit)).toBe(0);
  });

  it('previews the totals of a sale being typed, as the backend will compute them', () => {
    // The very numbers the backend answered on the same line: 10 bags at 5 000, VAT 18 %, 5 000 of transport.
    const cement: PendingLine = {
      articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
      unitLabel: 'Sac', appliedCoefficient: 50, quantity: 10, discountRate: 0, unitPrice: 5000, vatRate: 0.18,
    };

    expect(previewTotals([cement], 5000)).toEqual({
      grossAmount: 50000, discountAmount: 0, netAmount: 50000, vatAmount: 9000, totalAmount: 64000,
    });
  });

  it('deducts the discount of each line before the VAT, like the backend', () => {
    const cement: PendingLine = {
      articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
      unitLabel: 'Sac', appliedCoefficient: 50, quantity: 10, discountRate: 10, unitPrice: 5000, vatRate: 0.18,
    };

    expect(previewTotals([cement], 0)).toEqual({
      grossAmount: 50000, discountAmount: 5000, netAmount: 45000, vatAmount: 8100, totalAmount: 53100,
    });
  });

  it('keeps of a composed line only what the backend accepts', () => {
    const cement: PendingLine = {
      articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
      unitLabel: 'Sac', appliedCoefficient: 50, quantity: 10, discountRate: 5, unitPrice: 5000, vatRate: 0.18,
    };

    expect(toLineRequest(cement)).toEqual({ packagingId: 'k1', quantity: 10, discountRate: 5 });
  });

  it('allows cancelling only an untouched validated document', () => {
    expect(isCancellable(validated)).toBe(true);
    expect(isCancellable({ ...validated, status: 'DRAFT' })).toBe(false);
    expect(isCancellable({ ...validated, status: 'CANCELLED' })).toBe(false);
    expect(isCancellable({ ...validated, paidAmount: 1000 })).toBe(false);
    expect(isCancellable({ ...validated, deliveryStatus: 'PARTIALLY_DELIVERED' })).toBe(false);
  });
});
