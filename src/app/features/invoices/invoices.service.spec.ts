import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvoicesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists the documents of an agency and of a customer, page by page', () => {
    service.getByAgency('g1', 2).subscribe();
    service.getByCustomer('c1').subscribe();

    expect(httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').request.params.get('page')).toBe('2');
    expect(httpTesting.expectOne(r => r.url === '/api/v1/customers/c1/invoices').request.params.get('page')).toBe('0');
  });

  it('gets one document', () => {
    service.getById('i1').subscribe();

    expect(httpTesting.expectOne('/api/v1/invoices/i1').request.method).toBe('GET');
  });

  it('creates a draft', () => {
    service.create({ customerId: 'c1', type: 'INVOICE', creditMode: true }).subscribe();

    const req = httpTesting.expectOne('/api/v1/invoices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ customerId: 'c1', type: 'INVOICE', creditMode: true });
  });

  it('adds, updates and removes a line', () => {
    const body = { packagingId: 'k1', quantity: 3, discountRate: 5 };
    service.addLine('i1', body).subscribe();
    service.updateLine('i1', 'l1', body).subscribe();
    service.removeLine('i1', 'l1').subscribe();

    const add = httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/invoices/i1/lines');
    expect(add.request.body).toEqual(body);
    expect(httpTesting.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/invoices/i1/lines/l1').request.body).toEqual(body);
    httpTesting.expectOne(r => r.method === 'DELETE' && r.url === '/api/v1/invoices/i1/lines/l1');
  });

  it('validates, cancels with a reason, and deletes a draft', () => {
    service.validate('i1').subscribe();
    service.cancel('i1', 'Erreur de client').subscribe();
    service.deleteDraft('i1').subscribe();

    expect(httpTesting.expectOne('/api/v1/invoices/i1/validation').request.method).toBe('POST');
    expect(httpTesting.expectOne('/api/v1/invoices/i1/cancellation').request.body).toEqual({ reason: 'Erreur de client' });
    expect(httpTesting.expectOne('/api/v1/invoices/i1').request.method).toBe('DELETE');
  });
});
