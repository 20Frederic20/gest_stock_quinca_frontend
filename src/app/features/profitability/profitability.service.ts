import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ProfitabilityReport } from '../../core/models/profitability.model';
import { filenameFromContentDisposition } from '../invoices/invoice-format';

/** An export file, with the filename the backend suggests. */
export interface ProfitabilityFile {
  blob: Blob;
  filename: string;
}

/** Calls to the backend ProfitabilityController. */
@Injectable({ providedIn: 'root' })
export class ProfitabilityService {
  private http = inject(HttpClient);
  private url = '/api/v1/reports/profitability';

  get(from: string, to: string, agencyId?: string) {
    return this.http.get<ProfitabilityReport>(this.url, { params: this.params(from, to, agencyId) });
  }

  download(format: 'pdf' | 'xlsx', from: string, to: string, agencyId?: string) {
    return this.http
      .get(`${this.url}/${format}`, {
        params: this.params(from, to, agencyId),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map(
          (response): ProfitabilityFile => ({
            blob: response.body as Blob,
            filename:
              filenameFromContentDisposition(response.headers.get('Content-Disposition')) ??
              `rentabilite-${from}-${to}.${format}`,
          }),
        ),
      );
  }

  private params(from: string, to: string, agencyId?: string) {
    let params = new HttpParams().set('from', from).set('to', to);
    if (agencyId) params = params.set('agencyId', agencyId);
    return params;
  }
}
