import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CostingStatus, InitialCostLine } from '../../core/models/costing.model';

export interface InitialLotsFilter {
  agencyId?: string;
  missingOnly: boolean;
  search?: string;
}

/** Calls to the backend CostingController (FIFO cost tracking). */
@Injectable({ providedIn: 'root' })
export class CostingService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  status() {
    return this.http.get<CostingStatus>(`${this.url}/costing/status`);
  }

  /** Starts the cost tracking: the current stock becomes the opening lots. */
  start() {
    return this.http.post<CostingStatus>(`${this.url}/costing/start`, null);
  }

  initialLots(filter: InitialLotsFilter) {
    let params = new HttpParams().set('missingOnly', filter.missingOnly);
    if (filter.agencyId) params = params.set('agencyId', filter.agencyId);
    if (filter.search) params = params.set('search', filter.search);
    return this.http.get<InitialCostLine[]>(`${this.url}/costing/initial-lots`, { params });
  }

  setInitialCost(lotId: string, unitCost: number) {
    return this.http.put<InitialCostLine>(`${this.url}/costing/initial-lots/${lotId}`, { unitCost });
  }

  /** Last known unit cost of an article in an agency; null when unknown. */
  lastCost(agencyId: string, articleId: string) {
    return this.http.get<{ unitCost: number | null }>(
      `${this.url}/agencies/${agencyId}/costing/articles/${articleId}/last-cost`,
    );
  }
}
