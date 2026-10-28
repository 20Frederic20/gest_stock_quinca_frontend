import { Invoice } from '../../core/models/invoice.model';

/**
 * Backend rule (checkInvoiceCanBeDelivered): only a final invoice, validated. A fully delivered one
 * is left out here too — every line would be refused, so there is nothing to offer.
 */
export function isDeliverable(invoice: Invoice): boolean {
  return (
    invoice.type === 'INVOICE' && invoice.status === 'VALIDATED' && invoice.deliveryStatus !== 'FULLY_DELIVERED'
  );
}
