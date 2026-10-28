import { DeliveryStatus } from './invoice.model';

/** One article handed over on a delivery note, with where its invoice line stands afterwards. */
export interface DeliveryLine {
  id: string;
  invoiceLineId: string;
  articleId: string;
  designation: string;
  unitLabel: string;
  /** Handed over on this note. */
  quantity: number;
  /** Of the invoice line: sold, already delivered, and still owed. */
  invoicedQuantity: number;
  deliveredQuantity: number;
  remainingToDeliver: number;
}

/**
 * One handover of goods on an invoice. A cancelled note stays on file: the goods come back into
 * stock and are reserved for the customer again.
 */
export interface Delivery {
  id: string;
  /** Given at creation, e.g. "BL-COT-2026-00042". */
  number: string;
  /** ISO date, e.g. "2026-09-16". */
  deliveryDate: string;
  comment: string | null;
  cancelled: boolean;
  cancellationReason: string | null;
  invoiceId: string;
  invoiceNumber: string;
  /** Where the invoice stands after this note: the backend recomputes it every time. */
  invoiceDeliveryStatus: DeliveryStatus;
  customerId: string;
  customerName: string;
  createdById: string;
  createdByName: string;
  lines: DeliveryLine[];
  createdAt: string;
}

/** Only the invoice line and how much of it goes out: the backend knows the rest. */
export interface DeliveryLineRequest {
  invoiceLineId: string;
  quantity: number;
}

export interface DeliveryCreateRequest {
  comment: string | null;
  /** At least one line: the backend refuses an empty note. */
  lines: DeliveryLineRequest[];
}
