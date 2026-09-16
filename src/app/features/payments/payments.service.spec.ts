import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaymentsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists every payment of an invoice, newest first', () => {
    service.getByInvoice('i1').subscribe();

    expect(httpTesting.expectOne('/api/v1/invoices/i1/payments').request.method).toBe('GET');
  });

  it('lists the payments of an agency, page by page', () => {
    service.getByAgency('g1', 2).subscribe();

    expect(httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments').request.params.get('page')).toBe('2');
  });

  it('takes a payment on an invoice', () => {
    const body = { method: 'CHECK' as const, amount: 50000, externalReference: '4412887' };

    service.create('i1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/invoices/i1/payments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
  });

  it('cancels a payment with its reason', () => {
    service.cancel('p1', 'Chèque sans provision').subscribe();

    const req = httpTesting.expectOne('/api/v1/payments/p1/cancellation');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Chèque sans provision' });
  });
});
