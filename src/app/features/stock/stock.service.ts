import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PageResponse } from '../../core/models/page.model';
import {
  AgencyStock,
  ReversalRequest,
  StockAdjustmentRequest,
  StockMovement,
} from '../../core/models/stock.model';

const PAGE_SIZE = 20;

/** Calls to the backend StockController. The user of a movement comes from the session. */
@Injectable({ providedIn: 'root' })
export class StockService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /**
   * Only the articles that have moved at least once in this agency: a line is created on the first movement.
   * Sorted by designation, otherwise the backend returns an unstable order from one page to the next.
   */
  getByAgency(agencyId: string, page = 0) {
    return this.http.get<PageResponse<AgencyStock>>(`${this.url}/agencies/${agencyId}/stock`, {
      params: { page, size: PAGE_SIZE, sort: 'article.designation,asc' },
    });
  }

  /** Lines whose available quantity is below the article's alert threshold. Not paginated. */
  getAlerts(agencyId: string) {
    return this.http.get<AgencyStock[]>(`${this.url}/agencies/${agencyId}/stock/alerts`);
  }

  /** The same article in every agency that holds it. */
  getByArticle(articleId: string) {
    return this.http.get<AgencyStock[]>(`${this.url}/articles/${articleId}/stock`);
  }

  /** 404 when the article has never moved in this agency. */
  getOne(agencyId: string, articleId: string) {
    return this.http.get<AgencyStock>(`${this.url}/agencies/${agencyId}/stock/${articleId}`);
  }

  /**
   * Newest first. startDate/endDate are "yyyy-MM-dd"; startDate alone means that single day,
   * both means the whole period. Neither means no date filter at all.
   */
  getMovements(
    agencyId: string,
    options: { articleId?: string; page?: number; size?: number; startDate?: string; endDate?: string } = {},
  ) {
    const params: Record<string, string | number> = { page: options.page ?? 0, size: options.size ?? PAGE_SIZE };
    if (options.articleId) params['articleId'] = options.articleId;
    if (options.startDate) params['startDate'] = options.startDate;
    if (options.endDate) params['endDate'] = options.endDate;
    return this.http.get<PageResponse<StockMovement>>(`${this.url}/agencies/${agencyId}/stock-movements`, { params });
  }

  /** Inventory count: the backend records the difference with the current stock as an ADJUSTMENT. */
  adjust(agencyId: string, body: StockAdjustmentRequest) {
    return this.http.post<StockMovement>(`${this.url}/agencies/${agencyId}/stock/adjustments`, body);
  }

  /** Cancels a movement by recording the opposite one: the history is never rewritten. */
  reverse(movementId: string, body: ReversalRequest) {
    return this.http.post<StockMovement>(`${this.url}/stock-movements/${movementId}/reversal`, body);
  }
}
