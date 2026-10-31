import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Expense, ExpenseRequest } from '../../core/models/expense.model';
import { PageResponse } from '../../core/models/page.model';

export interface ExpenseFilter {
  from?: string;
  to?: string;
  agencyId?: string;
  /** true: common charges only; false: agency charges only; undefined: both. */
  common?: boolean;
  categoryId?: string;
  page: number;
  size: number;
}

/** Calls to the backend ExpenseController. */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private http = inject(HttpClient);
  private url = '/api/v1/expenses';

  /** Only the filters that are set are sent. */
  search(filter: ExpenseFilter) {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.from) params = params.set('from', filter.from);
    if (filter.to) params = params.set('to', filter.to);
    if (filter.agencyId) params = params.set('agencyId', filter.agencyId);
    if (filter.common !== undefined) params = params.set('common', filter.common);
    if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
    return this.http.get<PageResponse<Expense>>(this.url, { params });
  }

  create(body: ExpenseRequest) {
    return this.http.post<Expense>(this.url, body);
  }

  update(id: string, body: ExpenseRequest) {
    return this.http.put<Expense>(`${this.url}/${id}`, body);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
