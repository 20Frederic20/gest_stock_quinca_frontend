import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ExpenseCategory, ExpenseCategoryRequest } from '../../core/models/expense.model';

/** Calls to the backend ExpenseCategoryController. */
@Injectable({ providedIn: 'root' })
export class ExpenseCategoriesService {
  private http = inject(HttpClient);
  private url = '/api/v1/expense-categories';

  getAll(activeOnly: boolean) {
    return this.http.get<ExpenseCategory[]>(this.url, { params: { activeOnly } });
  }

  create(body: ExpenseCategoryRequest) {
    return this.http.post<ExpenseCategory>(this.url, body);
  }

  update(id: string, body: ExpenseCategoryRequest) {
    return this.http.put<ExpenseCategory>(`${this.url}/${id}`, body);
  }

  deactivate(id: string) {
    return this.http.post<ExpenseCategory>(`${this.url}/${id}/deactivate`, null);
  }

  activate(id: string) {
    return this.http.post<ExpenseCategory>(`${this.url}/${id}/activate`, null);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
