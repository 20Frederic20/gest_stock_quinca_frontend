import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PageResponse } from '../../core/models/page.model';
import { Supplier, SupplierRequest } from '../../core/models/supplier.model';

/** Calls to the backend SupplierController. Lists are paginated: 20 per page, sorted by company name. */
@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private http = inject(HttpClient);
  private url = '/api/v1/suppliers';

  getAll(page = 0) {
    return this.http.get<PageResponse<Supplier>>(this.url, { params: { page } });
  }

  /** Active ones only, for a choice list. Not paginated. */
  getActive() {
    return this.http.get<Supplier[]>(`${this.url}/active`);
  }

  /** Matches the code, the company name or the phone. */
  search(term: string, page = 0) {
    return this.http.get<PageResponse<Supplier>>(`${this.url}/search`, { params: { term: term.trim(), page } });
  }

  getById(id: string) {
    return this.http.get<Supplier>(`${this.url}/${id}`);
  }

  /** Refused by the backend when the code or the IFU is already taken. */
  create(body: SupplierRequest) {
    return this.http.post<Supplier>(this.url, body);
  }

  update(id: string, body: SupplierRequest) {
    return this.http.put<Supplier>(`${this.url}/${id}`, body);
  }

  activate(id: string) {
    return this.http.patch<Supplier>(`${this.url}/${id}/activate`, null);
  }

  deactivate(id: string) {
    return this.http.patch<Supplier>(`${this.url}/${id}/deactivate`, null);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
