import { CustomerCredit } from '../../core/models/customer.model';
import {
  DocumentStatus,
  DocumentType,
  Invoice,
  InvoiceLineRequest,
  DeliveryStatus,
  PendingLine,
  StockConsuming,
} from '../../core/models/invoice.model';
import { BadgeTone } from '../../shared/badge/badge.component';
import { formatMoney } from '../pricing/price-rules';

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
export function stockNeedsByArticle(lines: StockConsuming[]): { articleId: string; designation: string; needed: number }[] {
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
export function creditOverrun(creditMode: boolean, totalAmount: number, credit: CustomerCredit): number {
  if (!creditMode) return 0;
  return Math.max(0, totalAmount - credit.remainingCredit);
}

/** Four decimals, as the backend columns hold them. */
function round(amount: number): number {
  return Math.round(amount * 10000) / 10000;
}

/**
 * Totals of a sale being typed, computed like Invoice.computeTotals and InvoiceLine.computeAmounts:
 * the discount is a percentage, the VAT rate a fraction, and the transport is added after the VAT.
 * It is only a preview — the backend recomputes everything from its own prices when it saves.
 */
export function previewTotals(lines: PendingLine[], transportAmount: number) {
  let grossAmount = 0;
  let discountAmount = 0;
  let netAmount = 0;
  let vatAmount = 0;

  for (const line of lines) {
    const gross = line.quantity * line.unitPrice;
    const discount = round((gross * line.discountRate) / 100);
    const net = gross - discount;

    grossAmount += gross;
    discountAmount += discount;
    netAmount += net;
    vatAmount += round(net * line.vatRate);
  }

  return {
    grossAmount: round(grossAmount),
    discountAmount: round(discountAmount),
    netAmount: round(netAmount),
    vatAmount: round(vatAmount),
    totalAmount: round(netAmount + vatAmount + transportAmount),
  };
}

/** The price composed with the line is sent along: the seller may have raised it above the grid price. */
export function toLineRequest(line: PendingLine): InvoiceLineRequest {
  return {
    packagingId: line.packagingId,
    quantity: line.quantity,
    discountRate: line.discountRate,
    unitPrice: line.unitPrice,
  };
}

/** What validating commits to, in one sentence: shown before the seller confirms, wherever they confirm. */
export function validationSummary(invoice: Invoice): string {
  const parts = [`Total : ${formatMoney(invoice.totalAmount)}.`, 'Le document ne pourra plus être modifié.'];

  if (invoice.type === 'INVOICE') {
    parts.push('Le stock des articles sera réservé pour le client.');
    if (invoice.creditMode) parts.push('Le montant s’ajoutera à l’encours du client.');
  }

  return parts.join(' ');
}

/** Backend rule: a validated document is cancelled only while nothing was paid nor delivered. */
export function isCancellable(invoice: Invoice): boolean {
  return invoice.status === 'VALIDATED' && invoice.paidAmount === 0 && invoice.deliveryStatus === 'NOT_DELIVERED';
}

/**
 * Pulls the filename the backend suggested for a download out of a `Content-Disposition` header,
 * e.g. `inline; filename*=UTF-8''FAC-COT-2026-00001.pdf`. `null` when the header is missing or
 * in a shape this app never sends (there is no third party to be lenient for here).
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) return decodeURIComponent(encoded[1]);

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}
