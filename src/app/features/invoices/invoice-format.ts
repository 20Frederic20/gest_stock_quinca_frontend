import { CustomerCredit } from '../../core/models/customer.model';
import { DocumentStatus, DocumentType, Invoice, InvoiceLine, DeliveryStatus } from '../../core/models/invoice.model';
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

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  NOT_DELIVERED: 'Non livré',
  PARTIALLY_DELIVERED: 'Livraison partielle',
  FULLY_DELIVERED: 'Entièrement livré',
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

/**
 * What the whole document takes from the stock, article by article: the backend reserves the sum of
 * the lines at validation, so two lines of the same article must be counted together, not one by one.
 */
export function stockNeedsByArticle(lines: InvoiceLine[]): { articleId: string; designation: string; needed: number }[] {
  const needs = new Map<string, { articleId: string; designation: string; needed: number }>();

  for (const line of lines) {
    const quantity = stockQuantity(line.quantity, line.appliedCoefficient);
    const need = needs.get(line.articleId);
    if (need) {
      need.needed = Math.round((need.needed + quantity) * 10000) / 10000;
    } else {
      needs.set(line.articleId, { articleId: line.articleId, designation: line.designation, needed: quantity });
    }
  }

  return [...needs.values()];
}

/**
 * How far a credit sale goes past what the customer may still owe, 0 when it fits.
 * A cash sale never touches the outstanding balance, whatever its amount.
 */
export function creditOverrun(invoice: Invoice, credit: CustomerCredit): number {
  if (!invoice.creditMode) return 0;
  return Math.max(0, invoice.totalAmount - credit.remainingCredit);
}

/** Backend rule: a validated document is cancelled only while nothing was paid nor delivered. */
export function isCancellable(invoice: Invoice): boolean {
  return invoice.status === 'VALIDATED' && invoice.paidAmount === 0 && invoice.deliveryStatus === 'NOT_DELIVERED';
}
