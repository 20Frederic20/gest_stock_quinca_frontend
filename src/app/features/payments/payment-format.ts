import { Invoice } from '../../core/models/invoice.model';
import { PaymentMethod } from '../../core/models/payment.model';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile money',
  BANK_TRANSFER: 'Virement bancaire',
  CHECK: 'Chèque',
  CARD: 'Carte bancaire',
};

/** What the reference is, for each method: the field asks for the right thing. */
export const REFERENCE_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Référence (facultative)',
  MOBILE_MONEY: 'Identifiant de transaction',
  BANK_TRANSFER: 'Numéro d’opération',
  CHECK: 'Numéro du chèque',
  CARD: 'Numéro de ticket',
};

/** Backend rule (PaymentMethod.isReferenceRequired): only cash goes without a supporting document. */
export function referenceRequired(method: PaymentMethod): boolean {
  return method !== 'CASH';
}

/**
 * Backend rule (checkInvoiceCanBePaid): only a final invoice, validated, and still owing something.
 * A quote or a proforma commits nothing, so there is nothing to collect on it.
 */
export function isPayable(invoice: Invoice): boolean {
  return invoice.type === 'INVOICE' && invoice.status === 'VALIDATED' && invoice.remainingToPay > 0;
}

/**
 * "2026-10-29T08:05:00.123456" → "29/10/2026 à 08:05".
 * Read from the text: the backend sends a local date-time, and going through Date would shift it.
 */
export function formatDateTime(iso: string): string {
  const [date, time = ''] = iso.split('T');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} à ${time.slice(0, 5)}`;
}
