import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CustomerRequest } from '../../core/models/customer.model';
import { CustomersService } from './customers.service';

const URL = '/api/customers';

const body: CustomerRequest = {
  code: 'CLI-001', name: 'Bâtiments Houngbo', type: 'COMPANY', phone: null, address: null, taxId: null,
  creditLimit: 500000, paymentTermDays: 30, comment: null, privilegeId: 'p1',
};

describe('CustomersService', () => {
  let service: CustomersService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CustomersService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets a page of customers', () => {
    service.getAll(2).subscribe();

    const req = httpTesting.expectOne(r => r.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({});
  });

  it('searches customers from the first page by default', () => {
    service.search('houn').subscribe();

    const req = httpTesting.expectOne(r => r.url === `${URL}/search`);
    expect(req.request.params.get('term')).toBe('houn');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({});
  });

  it('gets one customer and their credit situation', () => {
    service.getById('c1').subscribe();
    service.getCredit('c1').subscribe();

    httpTesting.expectOne(`${URL}/c1`).flush({});
    httpTesting.expectOne(`${URL}/c1/credit`).flush({});
  });

  it('creates a customer', () => {
    service.create(body).subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates a customer', () => {
    service.update('c1', body).subscribe();

    const req = httpTesting.expectOne(`${URL}/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('activates and deactivates a customer', () => {
    service.activate('c1').subscribe();
    service.deactivate('c1').subscribe();

    expect(httpTesting.expectOne(`${URL}/c1/activate`).request.method).toBe('PATCH');
    expect(httpTesting.expectOne(`${URL}/c1/deactivate`).request.method).toBe('PATCH');
  });

  it('deletes a customer', () => {
    service.delete('c1').subscribe();

    const req = httpTesting.expectOne(`${URL}/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
