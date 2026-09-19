import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { PageResponse } from '../../core/models/page.model';
import {
  Transfer,
  TransferCreateRequest,
  TransferLineRequest,
  TransferReceiveRequest,
  TransferSummary,
} from '../../core/models/transfer.model';
import { filenameFromContentDisposition } from '../invoices/invoice-format';

/** A document's PDF, with the filename the backend suggests for the download. */
export interface TransferPdf {
  blob: Blob;
  filename: string;
}

/**
 * Calls to the backend TransferController. Every change to a transfer answers with the whole
 * document, lines included — as for purchase orders and invoices.
 */
@Injectable({ providedIn: 'root' })
export class TransfersService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /** Newest first, 20 per page. An agency's list carries what it sends and what it receives. */
  getByAgency(agencyId: string, page = 0) {
    return this.http.get<PageResponse<TransferSummary>>(`${this.url}/agencies/${agencyId}/transfers`, {
      params: { page },
    });
  }

  /** Sent and waiting for this agency to confirm reception. Not paginated. */
  getPendingReception(agencyId: string) {
    return this.http.get<TransferSummary[]>(`${this.url}/agencies/${agencyId}/transfers/pending`);
  }

  getById(id: string) {
    return this.http.get<Transfer>(`${this.url}/transfers/${id}`);
  }

  /** The "Bon de transfert" as a PDF, rendered by the backend itself. */
  getPdf(id: string) {
    return this.http
      .get(`${this.url}/transfers/${id}/pdf`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map(
          (response): TransferPdf => ({
            blob: response.body as Blob,
            filename: filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? `${id}.pdf`,
          }),
        ),
      );
  }

  /** Creates a draft, with or without its lines. Nothing moves in stock yet. */
  create(body: TransferCreateRequest) {
    return this.http.post<Transfer>(`${this.url}/transfers`, body);
  }

  addLine(transferId: string, body: TransferLineRequest) {
    return this.http.post<Transfer>(`${this.url}/transfers/${transferId}/lines`, body);
  }

  removeLine(transferId: string, lineId: string) {
    return this.http.delete<Transfer>(`${this.url}/transfers/${transferId}/lines/${lineId}`);
  }

  /** Sends the goods: they leave the source agency's stock. Refused with no line. */
  send(id: string) {
    return this.http.post<Transfer>(`${this.url}/transfers/${id}/shipment`, null);
  }

  /** Confirms what actually arrived; one atomic call settles the whole transfer. */
  receive(id: string, body: TransferReceiveRequest) {
    return this.http.post<Transfer>(`${this.url}/transfers/${id}/reception`, body);
  }

  /** Refused on a draft (delete it instead) or on an already cancelled transfer. */
  cancel(id: string, reason: string) {
    return this.http.post<Transfer>(`${this.url}/transfers/${id}/cancellation`, { reason });
  }

  /** Drafts only: a sent transfer is cancelled, never deleted. */
  deleteDraft(id: string) {
    return this.http.delete<void>(`${this.url}/transfers/${id}`);
  }
}
