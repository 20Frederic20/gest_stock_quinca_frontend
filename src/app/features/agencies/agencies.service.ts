import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Agency, AgencyRequest } from '../../core/models/agency.model';

/** Calls to the backend AgencyController. */
@Injectable({ providedIn: 'root' })
export class AgenciesService {
  private http = inject(HttpClient);
  private url = '/api/v1/agencies';

  /** Inactive agencies included, sorted by label. */
  getAll() {
    return this.http.get<Agency[]>(this.url);
  }

  getActive() {
    return this.http.get<Agency[]>(`${this.url}/active`);
  }

  getById(id: string) {
    return this.http.get<Agency>(`${this.url}/${id}`);
  }

  create(body: AgencyRequest) {
    return this.http.post<Agency>(this.url, body);
  }

  update(id: string, body: AgencyRequest) {
    return this.http.put<Agency>(`${this.url}/${id}`, body);
  }

  activate(id: string) {
    return this.http.patch<Agency>(`${this.url}/${id}/activate`, null);
  }

  deactivate(id: string) {
    return this.http.patch<Agency>(`${this.url}/${id}/deactivate`, null);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
