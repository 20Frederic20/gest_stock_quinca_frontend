import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PageResponse } from '../../core/models/page.model';
import {
  PurchaseOrder,
  PurchaseOrderCreateRequest,
  PurchaseOrderLineRequest,
  PurchaseOrderSummary,
} from '../../core/models/purchase-order.model';

/**
 * Calls to the backend PurchaseOrderController. Lists carry a summary without the lines; every change
 * to an order answers with the whole order, its lines and its totals recomputed.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /** Newest first, 20 per page. */
  getByAgency(agencyId: string, page = 0) {
    return this.http.get<PageResponse<PurchaseOrderSummary>>(`${this.url}/agencies/${agencyId}/purchase-orders`, {
      params: { page },
    });
  }

  /** Confirmed or partially received: what the agency is still waiting for. Not paginated. */
  getPending(agencyId: string) {
    return this.http.get<PurchaseOrderSummary[]>(`${this.url}/agencies/${agencyId}/purchase-orders/pending`);
  }

  getBySupplier(supplierId: string, page = 0) {
    return this.http.get<PageResponse<PurchaseOrderSummary>>(`${this.url}/suppliers/${supplierId}/purchase-orders`, {
      params: { page },
    });
  }

  getById(id: string) {
    return this.http.get<PurchaseOrder>(`${this.url}/purchase-orders/${id}`);
  }

  /** Creates a draft, with or without its lines. Refused for a deactivated supplier. */
  create(body: PurchaseOrderCreateRequest) {
    return this.http.post<PurchaseOrder>(`${this.url}/purchase-orders`, body);
  }

  addLine(orderId: string, body: PurchaseOrderLineRequest) {
    return this.http.post<PurchaseOrder>(`${this.url}/purchase-orders/${orderId}/lines`, body);
  }

  updateLine(orderId: string, lineId: string, body: PurchaseOrderLineRequest) {
    return this.http.put<PurchaseOrder>(`${this.url}/purchase-orders/${orderId}/lines/${lineId}`, body);
  }

  removeLine(orderId: string, lineId: string) {
    return this.http.delete<PurchaseOrder>(`${this.url}/purchase-orders/${orderId}/lines/${lineId}`);
  }

  /** Sends the order to the supplier: quantities and prices are frozen. Refused with no line. */
  confirm(id: string) {
    return this.http.post<PurchaseOrder>(`${this.url}/purchase-orders/${id}/confirmation`, null);
  }

  /** Refused once part of the goods has been received: cancel the receptions first. */
  cancel(id: string, reason: string) {
    return this.http.post<PurchaseOrder>(`${this.url}/purchase-orders/${id}/cancellation`, { reason });
  }

  /** Drafts only: a confirmed order is cancelled, never deleted. */
  deleteDraft(id: string) {
    return this.http.delete<void>(`${this.url}/purchase-orders/${id}`);
  }
}
