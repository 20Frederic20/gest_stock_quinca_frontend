import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Packaging, PackagingRequest } from '../../core/models/packaging.model';

/**
 * Calls to the backend PackagingController.
 * A packaging is listed and created under its article, then reached by its own id.
 */
@Injectable({ providedIn: 'root' })
export class PackagingsService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  getByArticle(articleId: string) {
    return this.http.get<Packaging[]>(`${this.url}/articles/${articleId}/packagings`);
  }

  create(articleId: string, body: PackagingRequest) {
    return this.http.post<Packaging>(`${this.url}/articles/${articleId}/packagings`, body);
  }

  getById(id: string) {
    return this.http.get<Packaging>(`${this.url}/packagings/${id}`);
  }

  update(id: string, body: PackagingRequest) {
    return this.http.put<Packaging>(`${this.url}/packagings/${id}`, body);
  }

  /** The backend removes the flag from the article's previous default packaging. */
  setDefaultPurchase(id: string) {
    return this.http.patch<Packaging>(`${this.url}/packagings/${id}/default-purchase`, null);
  }

  /** The backend removes the flag from the article's previous default packaging. */
  setDefaultSale(id: string) {
    return this.http.patch<Packaging>(`${this.url}/packagings/${id}/default-sale`, null);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/packagings/${id}`);
  }
}
