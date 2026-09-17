/** DRAFT has not moved the stock yet; CONFIRMED has; CANCELLED took the movements back. */
export type ReceptionStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface ReceptionLine {
  id: string;
  purchaseOrderLineId: string;
  articleId: string;
  articleCode: string;
  designation: string;
  unitLabel: string;
  quantity: number;
}

/** One arrival of goods against a purchase order. */
export interface Reception {
  id: string;
  /** Given at creation, e.g. "REC-COT-2026-00042". */
  number: string;
  status: ReceptionStatus;
  /** ISO date. */
  receptionDate: string;
  comment: string | null;
  cancellationReason: string | null;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  userId: string;
  userName: string;
  lines: ReceptionLine[];
  createdAt: string;
}

/** What the lists carry: the same document without its lines. */
export interface ReceptionSummary {
  id: string;
  number: string;
  status: ReceptionStatus;
  receptionDate: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface ReceptionLineRequest {
  purchaseOrderLineId: string;
  quantity: number;
}

export interface ReceptionCreateRequest {
  comment: string | null;
  lines: ReceptionLineRequest[];
}
