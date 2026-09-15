import { DocumentStatus, DocumentType, Invoice, WithdrawalStatus } from '../../core/models/invoice.model';
import { BadgeTone } from '../../shared/badge/badge.component';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  QUOTE: 'Devis',
  PROFORMA: 'Proforma',
  INVOICE: 'Facture',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validé',
  CANCELLED: 'Annulé',
};

/** A draft still waits for something: it stands out. */
export const DOCUMENT_STATUS_TONES: Record<DocumentStatus, BadgeTone> = {
  DRAFT: 'accent',
  VALIDATED: 'neutral',
  CANCELLED: 'muted',
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  NOT_WITHDRAWN: 'Non retiré',
  PARTIALLY_WITHDRAWN: 'Retrait partiel',
  FULLY_WITHDRAWN: 'Entièrement retiré',
};

/** 3 bags of 50 KG → 150: what a line takes from the stock, in the article's stock unit. */
export function stockQuantity(quantity: number, packagingQuantity: number): number {
  return Math.round(quantity * packagingQuantity * 10000) / 10000;
}

/** Amount before VAT of a line being typed, computed like the backend: quantity × price, minus the discount. */
export function lineNetAmount(quantity: number, unitPrice: number, discountRate: number): number {
  const gross = quantity * unitPrice;
  return gross - Math.round(((gross * discountRate) / 100) * 10000) / 10000;
}

/** Backend rule: a validated document is cancelled only while nothing was paid nor collected. */
export function isCancellable(invoice: Invoice): boolean {
  return invoice.status === 'VALIDATED' && invoice.paidAmount === 0 && invoice.withdrawalStatus === 'NOT_WITHDRAWN';
}
