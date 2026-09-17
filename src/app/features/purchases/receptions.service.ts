import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PageResponse } from '../../core/models/page.model';
import { Reception, ReceptionCreateRequest, ReceptionLineRequest, ReceptionSummary } from '../../core/models/reception.model';

/**
 * Calls to the backend ReceptionController. A reception is written as a draft, then confirmed:
 * only the confirmation moves the stock, and only a confirmed one can be cancelled.
 */
@Injectable({ providedIn: 'root' })
export class ReceptionsService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /** Newest first, 20 per page. Receptions only exist against an order. */
  getByOrder(orderId: string, page = 0) {
    return this.http.get<PageResponse<ReceptionSummary>>(`${this.url}/purchase-orders/${orderId}/receptions`, {
      params: { page },
    });
  }

  getById(id: string) {
    return this.http.get<Reception>(`${this.url}/receptions/${id}`);
  }

  /** Refused unless the order is waiting for its goods. */
  create(orderId: string, body: ReceptionCreateRequest) {
    return this.http.post<Reception>(`${this.url}/purchase-orders/${orderId}/receptions`, body);
  }

  addLine(receptionId: string, body: ReceptionLineRequest) {
    return this.http.post<Reception>(`${this.url}/receptions/${receptionId}/lines`, body);
  }

  removeLine(receptionId: string, lineId: string) {
    return this.http.delete<Reception>(`${this.url}/receptions/${receptionId}/lines/${lineId}`);
  }

  /** Moves the goods into the stock and advances the order. Refused with no line. */
  confirm(id: string) {
    return this.http.post<Reception>(`${this.url}/receptions/${id}/confirmation`, null);
  }

  /** Confirmed ones only: the stock movements are taken back. A draft is deleted instead. */
  cancel(id: string, reason: string) {
    return this.http.post<Reception>(`${this.url}/receptions/${id}/cancellation`, { reason });
  }

  deleteDraft(id: string) {
    return this.http.delete<void>(`${this.url}/receptions/${id}`);
  }
}
