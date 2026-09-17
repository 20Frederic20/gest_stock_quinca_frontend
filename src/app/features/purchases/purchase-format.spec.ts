import { PurchaseOrder } from '../../core/models/purchase-order.model';
import {
  ORDER_STATUS_LABELS,
  RECEPTION_STATUS_LABELS,
  isReceivable,
  orderCancellable,
} from './purchase-format';

const order = {
  status: 'CONFIRMED',
  lines: [{ receivedQuantity: 0, remainingToReceive: 10 }],
} as PurchaseOrder;

describe('purchase format', () => {
  it('names every status of an order and of a reception in French', () => {
    expect(ORDER_STATUS_LABELS.DRAFT).toBe('Brouillon');
    expect(ORDER_STATUS_LABELS.PARTIALLY_RECEIVED).toBe('Partiellement reçue');
    expect(ORDER_STATUS_LABELS.RECEIVED).toBe('Reçue');
    expect(RECEPTION_STATUS_LABELS.CONFIRMED).toBe('Confirmée');
  });

  it('receives goods only on an order waiting for them', () => {
    expect(isReceivable(order)).toBe(true);
    expect(isReceivable({ ...order, status: 'PARTIALLY_RECEIVED' })).toBe(true);
    expect(isReceivable({ ...order, status: 'DRAFT' })).toBe(false);
    expect(isReceivable({ ...order, status: 'RECEIVED' })).toBe(false);
    expect(isReceivable({ ...order, status: 'CANCELLED' })).toBe(false);
  });

  it('cancels a sent order only while nothing has been received', () => {
    expect(orderCancellable(order)).toBe(true);
    expect(orderCancellable({ ...order, status: 'PARTIALLY_RECEIVED' })).toBe(true);
    expect(orderCancellable({
      ...order, lines: [{ receivedQuantity: 4, remainingToReceive: 6 }],
    } as PurchaseOrder)).toBe(false);
    // A draft is deleted, not cancelled.
    expect(orderCancellable({ ...order, status: 'DRAFT' })).toBe(false);
    expect(orderCancellable({ ...order, status: 'CANCELLED' })).toBe(false);
  });
});
