import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExpensesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('searches with only the defined filters', () => {
    service.search({ from: '2026-01-01', common: true, page: 0, size: 20 }).subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/expenses');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('common')).toBe('true');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('to')).toBe(false);
    expect(req.request.params.has('agencyId')).toBe(false);
    expect(req.request.params.has('categoryId')).toBe(false);
    req.flush({ content: [] });
  });

  it('sends every filter when all are given, including common=false', () => {
    service
      .search({ from: 'a', to: 'b', agencyId: 'ag', common: false, categoryId: 'c', page: 2, size: 10 })
      .subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/expenses');
    expect(req.request.params.get('to')).toBe('b');
    expect(req.request.params.get('agencyId')).toBe('ag');
    expect(req.request.params.get('common')).toBe('false');
    expect(req.request.params.get('categoryId')).toBe('c');
    req.flush({ content: [] });
  });

  it('creates an expense', () => {
    const body = { expenseDate: '2026-01-02', categoryId: 'c', label: 'Loyer', amount: 5 };
    service.create(body).subscribe();

    const req = httpTesting.expectOne('/api/v1/expenses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates an expense', () => {
    const body = { expenseDate: '2026-01-02', categoryId: 'c', label: 'Loyer', amount: 5 };
    service.update('e1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/expenses/e1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('deletes an expense', () => {
    service.delete('e1').subscribe();

    const req = httpTesting.expectOne('/api/v1/expenses/e1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
