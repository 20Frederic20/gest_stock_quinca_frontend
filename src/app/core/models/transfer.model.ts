/** DRAFT is freely editable; SENT has left the source agency's stock; RECEIVED has entered the destination's. */
export type TransferStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';

export interface TransferLine {
  id: string;
  articleId: string;
  articleCode: string;
  designation: string;
  unitLabel: string;
  /** In the article's stock unit, not a packaging: figée dès l'envoi. */
  quantity: number;
  /** Zero until received; can differ from `quantity` when something breaks or is lost on the way. */
  receivedQuantity: number;
}

/** A stock transfer between two agencies, in two steps: sent, then received. */
export interface Transfer {
  id: string;
  /** Given at creation, e.g. "BT-COT-2026-00042". */
  number: string;
  status: TransferStatus;
  /** ISO date. */
  transferDate: string;
  /** Set only once the reception is confirmed. */
  receptionDate: string | null;
  comment: string | null;
  cancellationReason: string | null;
  /** The agency the goods leave. */
  sourceAgencyId: string;
  sourceAgencyLabel: string;
  /** The agency the goods arrive at. */
  destinationAgencyId: string;
  destinationAgencyLabel: string;
  createdById: string;
  createdByName: string;
  receivedById: string | null;
  receivedByName: string | null;
  lines: TransferLine[];
  createdAt: string;
}

/** What the lists carry: the same document without its lines. */
export interface TransferSummary {
  id: string;
  number: string;
  status: TransferStatus;
  transferDate: string;
  receptionDate: string | null;
  sourceAgencyId: string;
  sourceAgencyLabel: string;
  destinationAgencyId: string;
  destinationAgencyLabel: string;
  createdAt: string;
}

/** The creating user comes from the session; the source agency is chosen explicitly, own agency or not. */
export interface TransferCreateRequest {
  sourceAgencyId: string;
  destinationAgencyId: string;
  /** Null = today, decided by the backend. */
  transferDate: string | null;
  comment: string | null;
  lines: TransferLineRequest[];
}

export interface TransferLineRequest {
  articleId: string;
  /** In the article's stock unit: a transfer has no packaging, unlike a purchase order. */
  quantity: number;
}

export interface TransferReceiveLineRequest {
  transferLineId: string;
  /** What actually arrived; may be less than shipped (breakage, loss), never more. */
  quantity: number;
}

export interface TransferReceiveRequest {
  lines: TransferReceiveLineRequest[];
}
