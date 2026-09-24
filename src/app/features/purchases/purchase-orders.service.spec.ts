import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PurchaseOrdersService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists the orders of an agency and of a supplier, page by page', () => {
    service.getByAgency('g1', 2).subscribe();
    service.getBySupplier('f1').subscribe();

    expect(httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/purchase-orders').request.params.get('page'))
      .toBe('2');
    expect(httpTesting.expectOne(r => r.url === '/api/v1/suppliers/f1/purchase-orders').request.params.get('page'))
      .toBe('0');
  });

  it('lists the orders of an agency still waiting for their goods', () => {
    service.getPending('g1').subscribe();

    expect(httpTesting.expectOne('/api/v1/agencies/g1/purchase-orders/pending').request.method).toBe('GET');
  });

  it('gets one order with its lines', () => {
    service.getById('o1').subscribe();

    expect(httpTesting.expectOne('/api/v1/purchase-orders/o1').request.method).toBe('GET');
  });

  it('gets the PDF, named after what the backend suggests', () => {
    let result: { blob: Blob; filename: string } | undefined;
    service.getPdf('o1').subscribe(pdf => (result = pdf));

    const req = httpTesting.expectOne('/api/v1/purchase-orders/o1/pdf');
    expect(req.request.responseType).toBe('blob');

    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    req.flush(pdf, { headers: { 'Content-Disposition': "inline; filename*=UTF-8''CDE-COT-2026-00001.pdf" } });

    expect(result?.blob).toBe(pdf);
    expect(result?.filename).toBe('CDE-COT-2026-00001.pdf');
  });

  it('falls back to the order id as a filename when the header is missing', () => {
    let result: { blob: Blob; filename: string } | undefined;
    service.getPdf('o1').subscribe(pdf => (result = pdf));

    httpTesting.expectOne('/api/v1/purchase-orders/o1/pdf').flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(result?.filename).toBe('o1.pdf');
  });

  it('creates an order', () => {
    const body = { supplierId: 'f1', expectedDeliveryDate: '2026-10-01', comment: null, lines: [] };

    service.create(body).subscribe();

    const request = httpTesting.expectOne('/api/v1/purchase-orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
  });

  it('adds, updates and removes a line', () => {
    const body = { packagingId: 'k1', quantity: 10, unitPrice: 4200 };
    service.addLine('o1', body).subscribe();
    service.updateLine('o1', 'l1', body).subscribe();
    service.removeLine('o1', 'l1').subscribe();

    expect(httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/purchase-orders/o1/lines')
      .request.body).toEqual(body);
    expect(httpTesting.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/purchase-orders/o1/lines/l1')
      .request.body).toEqual(body);
    httpTesting.expectOne(r => r.method === 'DELETE' && r.url === '/api/v1/purchase-orders/o1/lines/l1');
  });

  it('confirms, cancels with a reason, and deletes a draft', () => {
    service.confirm('o1').subscribe();
    service.cancel('o1', 'Fournisseur en rupture').subscribe();
    service.deleteDraft('o1').subscribe();

    expect(httpTesting.expectOne('/api/v1/purchase-orders/o1/confirmation').request.method).toBe('POST');
    expect(httpTesting.expectOne('/api/v1/purchase-orders/o1/cancellation').request.body)
      .toEqual({ reason: 'Fournisseur en rupture' });
    expect(httpTesting.expectOne('/api/v1/purchase-orders/o1').request.method).toBe('DELETE');
  });
});
