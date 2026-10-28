import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { Invoice, InvoiceCreateRequest, InvoiceLineRequest } from '../../core/models/invoice.model';
import { PageResponse } from '../../core/models/page.model';
import { filenameFromContentDisposition } from './invoice-format';

/** A document's PDF, with the filename the backend suggests for the download. */
export interface InvoicePdf {
  blob: Blob;
  filename: string;
}

/**
 * Calls to the backend InvoiceController. Every change to a document answers with the whole document,
 * lines and totals recomputed.
 */
@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /** Newest document date first, 20 per page. */
  getByAgency(agencyId: string, page = 0) {
    return this.http.get<PageResponse<Invoice>>(`${this.url}/agencies/${agencyId}/invoices`, { params: { page } });
  }

  /** Newest document date first, 20 per page. */
  getByCustomer(customerId: string, page = 0) {
    return this.http.get<PageResponse<Invoice>>(`${this.url}/customers/${customerId}/invoices`, { params: { page } });
  }

  getById(id: string) {
    return this.http.get<Invoice>(`${this.url}/invoices/${id}`);
  }

  /** The document (invoice, quote or proforma) as a PDF, rendered by the backend itself. */
  getPdf(id: string) {
    return this.http
      .get(`${this.url}/invoices/${id}/pdf`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map(
          (response): InvoicePdf => ({
            blob: response.body as Blob,
            filename: filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? `${id}.pdf`,
          }),
        ),
      );
  }

  /** Creates an empty draft; its number is given right away. */
  create(body: InvoiceCreateRequest) {
    return this.http.post<Invoice>(`${this.url}/invoices`, body);
  }

  /** The unit price comes from the customer's price grid; refused when there is none. */
  addLine(invoiceId: string, body: InvoiceLineRequest) {
    return this.http.post<Invoice>(`${this.url}/invoices/${invoiceId}/lines`, body);
  }

  /** Only the quantity and the discount change: the packaging stays the one of the line. */
  updateLine(invoiceId: string, lineId: string, body: InvoiceLineRequest) {
    return this.http.put<Invoice>(`${this.url}/invoices/${invoiceId}/lines/${lineId}`, body);
  }

  removeLine(invoiceId: string, lineId: string) {
    return this.http.delete<Invoice>(`${this.url}/invoices/${invoiceId}/lines/${lineId}`);
  }

  /** Transport charges of a draft, before VAT: a partial change of the document, hence PATCH. */
  setTransport(invoiceId: string, transportAmount: number) {
    return this.http.patch<Invoice>(`${this.url}/invoices/${invoiceId}/transport`, { transportAmount });
  }

  /** Freezes the amounts; a final invoice also reserves the stock and checks the credit limit. */
  validate(id: string) {
    return this.http.post<Invoice>(`${this.url}/invoices/${id}/validation`, null);
  }

  /** Refused once something was paid or collected. Releases the reserved stock. */
  cancel(id: string, reason: string) {
    return this.http.post<Invoice>(`${this.url}/invoices/${id}/cancellation`, { reason });
  }

  /** Drafts only: a validated document is cancelled, never deleted. */
  deleteDraft(id: string) {
    return this.http.delete<void>(`${this.url}/invoices/${id}`);
  }
}
