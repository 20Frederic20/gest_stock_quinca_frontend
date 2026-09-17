import { OrderStatus, PurchaseOrder } from '../../core/models/purchase-order.model';
import { ReceptionStatus } from '../../core/models/reception.model';
import { BadgeTone } from '../../shared/badge/badge.component';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
  PARTIALLY_RECEIVED: 'Partiellement reçue',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

/** What still waits for something stands out; what is done or dropped fades. */
export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  DRAFT: 'accent',
  CONFIRMED: 'accent',
  PARTIALLY_RECEIVED: 'accent',
  RECEIVED: 'neutral',
  CANCELLED: 'muted',
};

export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
};

export const RECEPTION_STATUS_TONES: Record<ReceptionStatus, BadgeTone> = {
  DRAFT: 'accent',
  CONFIRMED: 'neutral',
  CANCELLED: 'muted',
};

/** Backend rule: goods are received against an order sent to the supplier and not yet complete. */
export function isReceivable(order: PurchaseOrder): boolean {
  return order.status === 'CONFIRMED' || order.status === 'PARTIALLY_RECEIVED';
}

/**
 * Backend rule: a sent order is cancelled only while nothing has arrived — the receptions have to be
 * cancelled first. A draft is deleted rather than cancelled.
 */
export function orderCancellable(order: PurchaseOrder): boolean {
  return isReceivable(order) && order.lines.every(line => line.receivedQuantity === 0);
}
