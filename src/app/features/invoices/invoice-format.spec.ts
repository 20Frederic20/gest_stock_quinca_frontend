import { Invoice } from '../../core/models/invoice.model';
import { isCancellable, lineNetAmount, stockQuantity } from './invoice-format';

const validated = {
  status: 'VALIDATED', paidAmount: 0, deliveryStatus: 'NOT_DELIVERED',
} as Invoice;

describe('invoice format', () => {
  it('converts a line quantity into stock units', () => {
    expect(stockQuantity(3, 50)).toBe(150);
    expect(stockQuantity(0.5, 0.3)).toBe(0.15);
  });

  it('estimates the amount before VAT, discount deducted', () => {
    expect(lineNetAmount(3, 5000, 0)).toBe(15000);
    expect(lineNetAmount(3, 5000, 10)).toBe(13500);
  });

  it('allows cancelling only an untouched validated document', () => {
    expect(isCancellable(validated)).toBe(true);
    expect(isCancellable({ ...validated, status: 'DRAFT' })).toBe(false);
    expect(isCancellable({ ...validated, status: 'CANCELLED' })).toBe(false);
    expect(isCancellable({ ...validated, paidAmount: 1000 })).toBe(false);
    expect(isCancellable({ ...validated, deliveryStatus: 'PARTIALLY_DELIVERED' })).toBe(false);
  });
});
