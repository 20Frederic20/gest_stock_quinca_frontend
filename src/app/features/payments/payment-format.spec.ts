import { Invoice } from '../../core/models/invoice.model';
import { PAYMENT_METHOD_LABELS, REFERENCE_LABELS, isPayable, referenceRequired } from './payment-format';

const invoice = {
  type: 'INVOICE', status: 'VALIDATED', remainingToPay: 59000,
} as Invoice;

describe('payment format', () => {
  it('names every method and every reference in French', () => {
    expect(PAYMENT_METHOD_LABELS.CASH).toBe('Espèces');
    expect(PAYMENT_METHOD_LABELS.MOBILE_MONEY).toBe('Mobile money');
    expect(REFERENCE_LABELS.CHECK).toBe('Numéro du chèque');
  });

  it('asks for a supporting document for anything but cash, like the backend', () => {
    expect(referenceRequired('CASH')).toBe(false);
    expect(referenceRequired('MOBILE_MONEY')).toBe(true);
    expect(referenceRequired('BANK_TRANSFER')).toBe(true);
    expect(referenceRequired('CHECK')).toBe(true);
    expect(referenceRequired('CARD')).toBe(true);
  });

  it('takes a payment only on a validated invoice that still owes something', () => {
    expect(isPayable(invoice)).toBe(true);
    expect(isPayable({ ...invoice, status: 'DRAFT' })).toBe(false);
    expect(isPayable({ ...invoice, status: 'CANCELLED' })).toBe(false);
    expect(isPayable({ ...invoice, type: 'PROFORMA' })).toBe(false);
    expect(isPayable({ ...invoice, type: 'QUOTE' })).toBe(false);
    expect(isPayable({ ...invoice, remainingToPay: 0 })).toBe(false);
  });
});
