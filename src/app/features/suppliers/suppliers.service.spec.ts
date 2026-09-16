import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SupplierRequest } from '../../core/models/supplier.model';
import { SuppliersService } from './suppliers.service';

const body: SupplierRequest = {
  code: 'FOU-001', companyName: 'Ciments du Bénin', address: 'Zone industrielle, Cotonou',
  phone: '+229 21 30 00 00', taxId: '3201900000002', paymentTerms: '30 jours fin de mois',
};

describe('SuppliersService', () => {
  let service: SuppliersService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SuppliersService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists the suppliers page by page, and searches them', () => {
    service.getAll(2).subscribe();
    service.search(' ciment ', 1).subscribe();

    expect(httpTesting.expectOne(r => r.url === '/api/v1/suppliers').request.params.get('page')).toBe('2');
    const search = httpTesting.expectOne(r => r.url === '/api/v1/suppliers/search');
    expect(search.request.params.get('term')).toBe('ciment');
    expect(search.request.params.get('page')).toBe('1');
  });

  it('lists the active suppliers for a choice list', () => {
    service.getActive().subscribe();

    expect(httpTesting.expectOne('/api/v1/suppliers/active').request.method).toBe('GET');
  });

  it('gets one supplier', () => {
    service.getById('f1').subscribe();

    expect(httpTesting.expectOne('/api/v1/suppliers/f1').request.method).toBe('GET');
  });

  it('creates and updates a supplier', () => {
    service.create(body).subscribe();
    service.update('f1', body).subscribe();

    const create = httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/suppliers');
    expect(create.request.body).toEqual(body);
    expect(httpTesting.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/suppliers/f1').request.body).toEqual(body);
  });

  it('activates, deactivates and deletes a supplier', () => {
    service.activate('f1').subscribe();
    service.deactivate('f1').subscribe();
    service.delete('f1').subscribe();

    expect(httpTesting.expectOne('/api/v1/suppliers/f1/activate').request.method).toBe('PATCH');
    expect(httpTesting.expectOne('/api/v1/suppliers/f1/deactivate').request.method).toBe('PATCH');
    expect(httpTesting.expectOne('/api/v1/suppliers/f1').request.method).toBe('DELETE');
  });
});
