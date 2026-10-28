/** How the customer paid. Only cash needs no supporting document. */
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CHECK' | 'CARD';

/** One instalment on an invoice. A cancelled payment stays on file and gives its amount back to the invoice. */
export interface Payment {
  id: string;
  /** Given at creation, e.g. "REG-COT-2026-00042". */
  number: string;
  method: PaymentMethod;
  amount: number;
  /** Cheque number, transaction id, terminal ticket… Null for cash. */
  externalReference: string | null;
  /** ISO date, e.g. "2026-09-16". */
  paymentDate: string;
  cancelled: boolean;
  cancellationReason: string | null;
  invoiceId: string;
  invoiceNumber: string;
  /** The invoice as it stands after this payment: the backend sends it back with every answer. */
  invoiceTotalAmount: number;
  invoicePaidAmount: number;
  invoiceRemainingToPay: number;
  customerId: string;
  customerName: string;
  /** The agency of the user who took the payment. */
  agencyId: string;
  agencyLabel: string;
  userId: string;
  userName: string;
  createdAt: string;
}

/** The invoice, the agency and the cashier come from the call and the session. */
export interface PaymentRequest {
  method: PaymentMethod;
  amount: number;
  /** Required by the backend for anything but cash. */
  externalReference: string | null;
}
