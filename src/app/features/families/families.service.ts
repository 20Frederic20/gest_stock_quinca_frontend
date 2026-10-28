import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Family, FamilyRequest } from '../../core/models/family.model';

/**
 * Calls to the backend FamilyController.
 * `/roots` and `/{id}/children` are not used: one getAll() is enough, the tree is built in the browser.
 */
@Injectable({ providedIn: 'root' })
export class FamiliesService {
  private http = inject(HttpClient);
  private url = '/api/v1/families';

  getAll() {
    return this.http.get<Family[]>(this.url);
  }

  getById(id: string) {
    return this.http.get<Family>(`${this.url}/${id}`);
  }

  create(body: FamilyRequest) {
    return this.http.post<Family>(this.url, body);
  }

  update(id: string, body: FamilyRequest) {
    return this.http.put<Family>(`${this.url}/${id}`, body);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
