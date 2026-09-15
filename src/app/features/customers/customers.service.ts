import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Customer, CustomerCredit, CustomerRequest } from '../../core/models/customer.model';
import { PageResponse } from '../../core/models/page.model';

/**
 * Calls to the backend CustomerController. Lists are paginated: 20 per page, sorted by name.
 */
@Injectable({ providedIn: 'root' })
export class CustomersService {
  private http = inject(HttpClient);
  private url = '/api/v1/customers';

  getAll(page = 0) {
    return this.http.get<PageResponse<Customer>>(this.url, { params: { page } });
  }

  /** Matches code, name or phone. */
  search(term: string, page = 0) {
    return this.http.get<PageResponse<Customer>>(`${this.url}/search`, { params: { term, page } });
  }

  getById(id: string) {
    return this.http.get<Customer>(`${this.url}/${id}`);
  }

  getCredit(id: string) {
    return this.http.get<CustomerCredit>(`${this.url}/${id}/credit`);
  }

  create(body: CustomerRequest) {
    return this.http.post<Customer>(this.url, body);
  }

  /** Refused by the backend when the new credit limit is below the current balance. */
  update(id: string, body: CustomerRequest) {
    return this.http.put<Customer>(`${this.url}/${id}`, body);
  }

  activate(id: string) {
    return this.http.patch<Customer>(`${this.url}/${id}/activate`, null);
  }

  deactivate(id: string) {
    return this.http.patch<Customer>(`${this.url}/${id}/deactivate`, null);
  }

  /** Refused by the backend while the customer still owes money. */
  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
