import { Invoice } from '../../core/models/invoice.model';
import { isDeliverable } from './delivery-format';

const invoice = {
  type: 'INVOICE', status: 'VALIDATED', deliveryStatus: 'NOT_DELIVERED',
} as Invoice;

describe('delivery format', () => {
  it('hands goods over only on a validated invoice that still owes some', () => {
    expect(isDeliverable(invoice)).toBe(true);
    expect(isDeliverable({ ...invoice, deliveryStatus: 'PARTIALLY_DELIVERED' })).toBe(true);
    expect(isDeliverable({ ...invoice, deliveryStatus: 'FULLY_DELIVERED' })).toBe(false);
    expect(isDeliverable({ ...invoice, status: 'DRAFT' })).toBe(false);
    expect(isDeliverable({ ...invoice, status: 'CANCELLED' })).toBe(false);
    expect(isDeliverable({ ...invoice, type: 'PROFORMA' })).toBe(false);
    expect(isDeliverable({ ...invoice, type: 'QUOTE' })).toBe(false);
  });
});
