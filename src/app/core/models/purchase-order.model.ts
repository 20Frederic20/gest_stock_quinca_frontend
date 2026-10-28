/** DRAFT is freely editable; CONFIRMED freezes quantities and prices; the rest follows the receptions. */
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLine {
  id: string;
  articleId: string;
  articleCode: string;
  designation: string;
  packagingId: string;
  unitLabel: string;
  /** In the chosen packaging. */
  quantity: number;
  receivedQuantity: number;
  remainingToReceive: number;
  /** Purchase price, typed by the buyer: nothing computes it. */
  unitPrice: number;
  /** Fraction, like the article's: 0.18 for 18 %. */
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  /** Given at creation, e.g. "CDE-COT-2026-00042". */
  number: string;
  status: OrderStatus;
  /** ISO date. */
  orderDate: string;
  expectedDeliveryDate: string | null;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  comment: string | null;
  cancellationReason: string | null;
  supplierId: string;
  supplierName: string;
  agencyId: string;
  agencyLabel: string;
  userId: string;
  userName: string;
  lines: PurchaseOrderLine[];
  createdAt: string;
}

/** What the lists carry: the same document without its lines. */
export interface PurchaseOrderSummary {
  id: string;
  number: string;
  status: OrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  totalAmount: number;
  supplierId: string;
  supplierName: string;
  agencyId: string;
  agencyLabel: string;
  createdAt: string;
}

/** The agency and the buyer come from the session. */
export interface PurchaseOrderCreateRequest {
  supplierId: string;
  /** Never in the past: the backend refuses it. Null when unknown. */
  expectedDeliveryDate: string | null;
  comment: string | null;
  lines: PurchaseOrderLineRequest[];
}

export interface PurchaseOrderLineRequest {
  packagingId: string;
  quantity: number;
  unitPrice: number;
}
