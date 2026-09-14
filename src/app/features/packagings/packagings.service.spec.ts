import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PackagingRequest } from '../../core/models/packaging.model';
import { PackagingsService } from './packagings.service';

const body: PackagingRequest = { unitId: 'u2', quantity: 50, defaultPurchase: false, defaultSale: true };

describe('PackagingsService', () => {
  let service: PackagingsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PackagingsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets the packagings of an article', () => {
    service.getByArticle('a1').subscribe();

    const req = httpTesting.expectOne('/api/v1/articles/a1/packagings');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('creates a packaging under its article', () => {
    service.create('a1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/articles/a1/packagings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('gets one packaging by id', () => {
    service.getById('p1').subscribe();

    const req = httpTesting.expectOne('/api/v1/packagings/p1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updates a packaging', () => {
    service.update('p1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/packagings/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('marks a packaging as the default for purchases', () => {
    service.setDefaultPurchase('p1').subscribe();

    const req = httpTesting.expectOne('/api/v1/packagings/p1/default-purchase');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('marks a packaging as the default for sales', () => {
    service.setDefaultSale('p1').subscribe();

    const req = httpTesting.expectOne('/api/v1/packagings/p1/default-sale');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deletes a packaging', () => {
    service.delete('p1').subscribe();

    const req = httpTesting.expectOne('/api/v1/packagings/p1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
