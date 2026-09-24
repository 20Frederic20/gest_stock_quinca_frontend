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
  /**
   * Stock units in one unit of the packaging, copied when the line was added: 50 for a 50 KG bag.
   * Frozen like the price, so that a later change of the packaging does not move an existing document.
   */
  appliedCoefficient: number;
  /** In the chosen packaging (3 bags, 2 pallets…). */
  quantity: number;
  deliveredQuantity: number;
  remainingToDeliver: number;
  /** The customer's price grid by default; the seller may raise it, never below the packaging's own price. */
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
  /** Transport charges, before VAT, typed on the draft. Counted in totalAmount, never in netAmount. */
  transportAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingToPay: number;
  creditMode: boolean;
  cancellationReason: string | null;
  /** Null for a walk-in sale, which has no customer record. */
  customerId: string | null;
  /** The customer's name, or the free-text name (or a generic label) for a walk-in sale. */
  customerName: string;
  /** The agency of the user who created the document. */
  agencyId: string;
  agencyLabel: string;
  userId: string;
  userName: string;
  lines: InvoiceLine[];
  createdAt: string;
}

/**
 * A line being typed, before the backend has seen it. It carries what the screen needs to show
 * (price, VAT, packaging) on top of what the backend accepts, which is only the three fields of
 * InvoiceLineRequest — the price is always the backend's, never what the front displays.
 */
export interface PendingLine {
  articleId: string;
  articleCode: string;
  designation: string;
  packagingId: string;
  unitLabel: string;
  appliedCoefficient: number;
  quantity: number;
  discountRate: number;
  unitPrice: number;
  vatRate: number;
}

/** What is needed to know how much of the stock a line takes: a saved line or one being typed. */
export type StockConsuming = Pick<InvoiceLine, 'articleId' | 'designation' | 'quantity' | 'appliedCoefficient'>;

/** The agency and the seller come from the session. */
export interface InvoiceCreateRequest {
  /** Null for a walk-in sale: see walkInCustomerName. */
  customerId: string | null;
  /** Free-text name of the customer, used only when customerId is null. Optional, may be left blank. */
  walkInCustomerName?: string | null;
  type: DocumentType;
  creditMode: boolean;
  /** Before VAT. Zero when the sale carries no transport charges. */
  transportAmount: number;
  /** The whole sale in one call: either everything is saved, or nothing is. */
  lines: InvoiceLineRequest[];
}

export interface InvoiceLineRequest {
  packagingId: string;
  quantity: number;
  discountRate: number;
  /** Override of the price grid; refused below the packaging's own price. Null/absent = grid price. */
  unitPrice?: number | null;
}
