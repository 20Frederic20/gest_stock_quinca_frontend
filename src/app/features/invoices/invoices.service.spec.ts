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

  it('gets the PDF, named after what the backend suggests', () => {
    let result: { blob: Blob; filename: string } | undefined;
    service.getPdf('i1').subscribe(pdf => (result = pdf));

    const req = httpTesting.expectOne('/api/v1/invoices/i1/pdf');
    expect(req.request.responseType).toBe('blob');

    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    req.flush(pdf, { headers: { 'Content-Disposition': "inline; filename*=UTF-8''FAC-COT-2026-00001.pdf" } });

    expect(result?.blob).toBe(pdf);
    expect(result?.filename).toBe('FAC-COT-2026-00001.pdf');
  });

  it('falls back to the document id as a filename when the header is missing', () => {
    let result: { blob: Blob; filename: string } | undefined;
    service.getPdf('i1').subscribe(pdf => (result = pdf));

    httpTesting.expectOne('/api/v1/invoices/i1/pdf').flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(result?.filename).toBe('i1.pdf');
  });

  it('creates a document with its lines and its transport in one call', () => {
    const body = {
      customerId: 'c1',
      type: 'INVOICE' as const,
      creditMode: true,
      transportAmount: 5000,
      lines: [{ packagingId: 'k1', quantity: 3, discountRate: 0 }],
    };

    service.create(body).subscribe();

    const req = httpTesting.expectOne('/api/v1/invoices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
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

  it('sets the transport charges of a draft', () => {
    service.setTransport('i1', 5000).subscribe();

    const req = httpTesting.expectOne('/api/v1/invoices/i1/transport');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ transportAmount: 5000 });
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
