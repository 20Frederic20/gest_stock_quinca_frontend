import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReceptionsService } from './receptions.service';

describe('ReceptionsService', () => {
  let service: ReceptionsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReceptionsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists the receptions of an order, page by page', () => {
    service.getByOrder('o1', 1).subscribe();

    expect(httpTesting.expectOne(r => r.url === '/api/v1/purchase-orders/o1/receptions').request.params.get('page'))
      .toBe('1');
  });

  it('gets one reception with its lines', () => {
    service.getById('r1').subscribe();

    expect(httpTesting.expectOne('/api/v1/receptions/r1').request.method).toBe('GET');
  });

  it('opens a reception on an order', () => {
    const body = { comment: 'Camion du matin', lines: [{ purchaseOrderLineId: 'l1', quantity: 10 }] };

    service.create('o1', body).subscribe();

    const request = httpTesting.expectOne('/api/v1/purchase-orders/o1/receptions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
  });

  it('adds and removes a line of a draft reception', () => {
    service.addLine('r1', { purchaseOrderLineId: 'l1', quantity: 2 }).subscribe();
    service.removeLine('r1', 'rl1').subscribe();

    expect(httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/receptions/r1/lines')
      .request.body).toEqual({ purchaseOrderLineId: 'l1', quantity: 2 });
    httpTesting.expectOne(r => r.method === 'DELETE' && r.url === '/api/v1/receptions/r1/lines/rl1');
  });

  it('confirms, cancels with a reason, and deletes a draft', () => {
    service.confirm('r1').subscribe();
    service.cancel('r1', 'Marchandise refusée').subscribe();
    service.deleteDraft('r1').subscribe();

    expect(httpTesting.expectOne('/api/v1/receptions/r1/confirmation').request.method).toBe('POST');
    expect(httpTesting.expectOne('/api/v1/receptions/r1/cancellation').request.body)
      .toEqual({ reason: 'Marchandise refusée' });
    expect(httpTesting.expectOne('/api/v1/receptions/r1').request.method).toBe('DELETE');
  });
});
