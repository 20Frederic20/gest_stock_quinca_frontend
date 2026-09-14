import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Privilege, PrivilegeRequest } from '../../core/models/privilege.model';

/** Calls to the backend PrivilegeController. Exactly one privilege is the default at any time. */
@Injectable({ providedIn: 'root' })
export class PrivilegesService {
  private http = inject(HttpClient);
  private url = '/api/v1/privileges';

  getAll() {
    return this.http.get<Privilege[]>(this.url);
  }

  getDefault() {
    return this.http.get<Privilege>(`${this.url}/default`);
  }

  getById(id: string) {
    return this.http.get<Privilege>(`${this.url}/${id}`);
  }

  create(body: PrivilegeRequest) {
    return this.http.post<Privilege>(this.url, body);
  }

  update(id: string, body: PrivilegeRequest) {
    return this.http.put<Privilege>(`${this.url}/${id}`, body);
  }

  /** The backend removes the flag from the previous default privilege. */
  setDefault(id: string) {
    return this.http.patch<Privilege>(`${this.url}/${id}/default`, null);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
