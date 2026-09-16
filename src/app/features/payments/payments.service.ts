import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PageResponse } from '../../core/models/page.model';
import { Payment, PaymentRequest } from '../../core/models/payment.model';

/**
 * Calls to the backend PaymentController. Every answer carries the invoice as it stands after the
 * operation — total, paid, remaining — so the screen never has to guess what a payment changed.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /** Newest payment date first. Not paginated: an invoice has few of them. */
  getByInvoice(invoiceId: string) {
    return this.http.get<Payment[]>(`${this.url}/invoices/${invoiceId}/payments`);
  }

  /** Newest first, 20 per page. */
  getByAgency(agencyId: string, page = 0) {
    return this.http.get<PageResponse<Payment>>(`${this.url}/agencies/${agencyId}/payments`, { params: { page } });
  }

  /** Refused on anything but a validated invoice, and above what is left to pay. */
  create(invoiceId: string, body: PaymentRequest) {
    return this.http.post<Payment>(`${this.url}/invoices/${invoiceId}/payments`, body);
  }

  /** The payment stays on file; its amount goes back to what the invoice still owes. */
  cancel(id: string, reason: string) {
    return this.http.post<Payment>(`${this.url}/payments/${id}/cancellation`, { reason });
  }
}
