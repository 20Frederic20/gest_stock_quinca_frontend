/** Quote and proforma commit nothing; only a final invoice reserves stock and counts as a sale. */
export type DocumentType = 'QUOTE' | 'PROFORMA' | 'INVOICE';

/** DRAFT is freely editable; VALIDATED freezes the amounts; CANCELLED keeps the document for the record. */
export type DocumentStatus = 'DRAFT' | 'VALIDATED' | 'CANCELLED';

/** How much of the goods has already been delivered to the customer. */
export type DeliveryStatus = 'NOT_DELIVERED' | 'PARTIALLY_DELIVERED' | 'FULLY_DELIVERED';

export interface InvoiceLine {
  id: string;
  articleId: string;
  articleCode: string;
  /** Copied from the article when the line was added: renaming the article does not change the document. */
  designation: string;
  packagingId: string;
  unitLabel: string;
  /** In the chosen packaging (3 bags, 2 pallets…). */
  quantity: number;
  deliveredQuantity: number;
  remainingToDeliver: number;
  /** Set by the backend from the customer's price grid, never sent by the front. */
  unitPrice: number;
  /** In percent, 0 to 100. */
  discountRate: number;
  discountAmount: number;
  /** Fraction, like the article's: 0.18 for 18 %. */
  vatRate: number;
  /** Before VAT, after discount. */
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface Invoice {
  id: string;
  /** Given at creation, e.g. "FAC-COT-2026-00042". */
  number: string;
  type: DocumentType;
  status: DocumentStatus;
  deliveryStatus: DeliveryStatus;
  /** ISO date, e.g. "2026-09-15". */
  documentDate: string;
  /** Credit sales only: document date + the customer's payment term. */
  dueDate: string | null;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingToPay: number;
  creditMode: boolean;
  cancellationReason: string | null;
  customerId: string;
  customerName: string;
  /** The agency of the user who created the document. */
  agencyId: string;
  agencyLabel: string;
  userId: string;
  userName: string;
  lines: InvoiceLine[];
  createdAt: string;
}

/** The agency and the seller come from the session. */
export interface InvoiceCreateRequest {
  customerId: string;
  type: DocumentType;
  creditMode: boolean;
}

export interface InvoiceLineRequest {
  packagingId: string;
  quantity: number;
  discountRate: number;
}
