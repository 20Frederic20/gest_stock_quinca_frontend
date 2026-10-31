import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExpenseCategoriesService } from './expense-categories.service';

describe('ExpenseCategoriesService', () => {
  let service: ExpenseCategoriesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExpenseCategoriesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets the categories, with the activeOnly flag', () => {
    service.getAll(true).subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/expense-categories');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('activeOnly')).toBe('true');
    req.flush([]);
  });

  it('creates a category', () => {
    service.create({ label: 'Loyer' }).subscribe();

    const req = httpTesting.expectOne('/api/v1/expense-categories');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ label: 'Loyer' });
    req.flush({});
  });

  it('updates a category', () => {
    service.update('c1', { label: 'Loyer', description: 'd' }).subscribe();

    const req = httpTesting.expectOne('/api/v1/expense-categories/c1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ label: 'Loyer', description: 'd' });
    req.flush({});
  });

  it('deactivates a category', () => {
    service.deactivate('c1').subscribe();

    const req = httpTesting.expectOne('/api/v1/expense-categories/c1/deactivate');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('activates a category', () => {
    service.activate('c1').subscribe();

    const req = httpTesting.expectOne('/api/v1/expense-categories/c1/activate');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deletes a category', () => {
    service.delete('c1').subscribe();

    const req = httpTesting.expectOne('/api/v1/expense-categories/c1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
