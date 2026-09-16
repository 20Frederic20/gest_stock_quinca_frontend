import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeliveriesService } from './deliveries.service';

describe('DeliveriesService', () => {
  let service: DeliveriesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DeliveriesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists every delivery note of an invoice', () => {
    service.getByInvoice('i1').subscribe();

    expect(httpTesting.expectOne('/api/v1/invoices/i1/deliveries').request.method).toBe('GET');
  });

  it('lists the delivery notes of an agency, page by page', () => {
    service.getByAgency('g1', 3).subscribe();

    expect(httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/deliveries').request.params.get('page')).toBe('3');
  });

  it('hands goods over on an invoice', () => {
    const body = { comment: 'Livré au chantier', lines: [{ invoiceLineId: 'l1', quantity: 3 }] };

    service.create('i1', body).subscribe();

    const request = httpTesting.expectOne('/api/v1/invoices/i1/deliveries');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
  });

  it('cancels a delivery note with its reason', () => {
    service.cancel('d1', 'Marchandise retournée').subscribe();

    const request = httpTesting.expectOne('/api/v1/deliveries/d1/cancellation');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Marchandise retournée' });
  });
});
