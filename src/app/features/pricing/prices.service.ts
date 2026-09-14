import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ArticlePrice, ArticlePriceRequest } from '../../core/models/article-price.model';

/**
 * Calls to the backend ArticlePriceController.
 * Its URLs have no /v1: the controller is mapped on /api, unlike the others.
 */
@Injectable({ providedIn: 'root' })
export class PricesService {
  private http = inject(HttpClient);
  private url = '/api';

  /** Newest start date first. */
  getByPackaging(packagingId: string) {
    return this.http.get<ArticlePrice[]>(`${this.url}/packagings/${packagingId}/prices`);
  }

  /** Every price of one privilege for this packaging, newest start date first. */
  getHistory(packagingId: string, privilegeId: string) {
    return this.http.get<ArticlePrice[]>(`${this.url}/packagings/${packagingId}/prices/history`, {
      params: { privilegeId },
    });
  }

  /** Price applied on `date` (ISO), today when omitted. */
  getApplicable(packagingId: string, privilegeId: string, date?: string) {
    const params: Record<string, string> = date ? { privilegeId, date } : { privilegeId };
    return this.http.get<ArticlePrice>(`${this.url}/packagings/${packagingId}/prices/applicable`, { params });
  }

  create(packagingId: string, body: ArticlePriceRequest) {
    return this.http.post<ArticlePrice>(`${this.url}/packagings/${packagingId}/prices`, body);
  }

  getById(id: string) {
    return this.http.get<ArticlePrice>(`${this.url}/prices/${id}`);
  }

  /** Refused by the backend once the price has started. */
  update(id: string, body: ArticlePriceRequest) {
    return this.http.put<ArticlePrice>(`${this.url}/prices/${id}`, body);
  }

  /** Refused by the backend once the price has started. */
  delete(id: string) {
    return this.http.delete<void>(`${this.url}/prices/${id}`);
  }
}
