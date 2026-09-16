import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Delivery, DeliveryCreateRequest } from '../../core/models/delivery.model';
import { PageResponse } from '../../core/models/page.model';

/**
 * Calls to the backend DeliveryController. A delivery note moves the goods out of the stock and
 * frees what was reserved; its answer says where the invoice then stands, line by line.
 */
@Injectable({ providedIn: 'root' })
export class DeliveriesService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /** Newest delivery date first. Not paginated: an invoice has few of them. */
  getByInvoice(invoiceId: string) {
    return this.http.get<Delivery[]>(`${this.url}/invoices/${invoiceId}/deliveries`);
  }

  /** Newest first, 20 per page. */
  getByAgency(agencyId: string, page = 0) {
    return this.http.get<PageResponse<Delivery>>(`${this.url}/agencies/${agencyId}/deliveries`, { params: { page } });
  }

  /** Refused on anything but a validated invoice, and beyond what is left to deliver on a line. */
  create(invoiceId: string, body: DeliveryCreateRequest) {
    return this.http.post<Delivery>(`${this.url}/invoices/${invoiceId}/deliveries`, body);
  }

  /** The note stays on file; the goods come back into stock and are reserved again. */
  cancel(id: string, reason: string) {
    return this.http.post<Delivery>(`${this.url}/deliveries/${id}/cancellation`, { reason });
  }
}
