import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Article, ArticleRequest } from '../../core/models/article.model';
import { PageResponse } from '../../core/models/page.model';

/**
 * Calls to the backend ArticleController.
 * The three lists are paginated: 20 per page, sorted by designation (backend defaults).
 */
@Injectable({ providedIn: 'root' })
export class ArticlesService {
  private http = inject(HttpClient);
  private url = '/api/v1/articles';

  getAll(page = 0) {
    return this.http.get<PageResponse<Article>>(this.url, { params: { page } });
  }

  /** Matches code, designation or barcode, case-insensitive. */
  search(term: string, page = 0) {
    return this.http.get<PageResponse<Article>>(`${this.url}/search`, { params: { term, page } });
  }

  getByFamily(familyId: string, page = 0) {
    return this.http.get<PageResponse<Article>>(`${this.url}/by-family/${familyId}`, { params: { page } });
  }

  getById(id: string) {
    return this.http.get<Article>(`${this.url}/${id}`);
  }

  create(body: ArticleRequest) {
    return this.http.post<Article>(this.url, body);
  }

  update(id: string, body: ArticleRequest) {
    return this.http.put<Article>(`${this.url}/${id}`, body);
  }

  activate(id: string) {
    return this.http.patch<Article>(`${this.url}/${id}/activate`, null);
  }

  deactivate(id: string) {
    return this.http.patch<Article>(`${this.url}/${id}/deactivate`, null);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
