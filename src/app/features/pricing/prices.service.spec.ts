import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ArticlePriceRequest } from '../../core/models/article-price.model';
import { PricesService } from './prices.service';

const body: ArticlePriceRequest = { privilegeId: 'p1', unitPrice: 5000, startDate: '2026-12-01' };

describe('PricesService', () => {
  let service: PricesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PricesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets every price of a packaging', () => {
    service.getByPackaging('k1').subscribe();

    const req = httpTesting.expectOne('/api/v1/packagings/k1/prices');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets the history of a packaging for one privilege', () => {
    service.getHistory('k1', 'p1').subscribe();

    const req = httpTesting.expectOne(r => r.url === '/api/v1/packagings/k1/prices/history');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('privilegeId')).toBe('p1');
    req.flush([]);
  });

  it('gets the applicable price, today unless a date is given', () => {
    service.getApplicable('k1', 'p1').subscribe();
    const today = httpTesting.expectOne(r => r.url === '/api/v1/packagings/k1/prices/applicable');
    expect(today.request.params.get('privilegeId')).toBe('p1');
    expect(today.request.params.has('date')).toBe(false);
    today.flush({});

    service.getApplicable('k1', 'p1', '2026-12-25').subscribe();
    const dated = httpTesting.expectOne(r => r.url === '/api/v1/packagings/k1/prices/applicable');
    expect(dated.request.params.get('date')).toBe('2026-12-25');
    dated.flush({});
  });

  it('creates a price under its packaging', () => {
    service.create('k1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/packagings/k1/prices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('gets one price by id', () => {
    service.getById('x1').subscribe();

    const req = httpTesting.expectOne('/api/v1/prices/x1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updates a price', () => {
    service.update('x1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/prices/x1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('deletes a price', () => {
    service.delete('x1').subscribe();

    const req = httpTesting.expectOne('/api/v1/prices/x1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
