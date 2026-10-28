import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AgencyRequest } from '../../core/models/agency.model';
import { AgenciesService } from './agencies.service';

const URL = '/api/v1/agencies';

const body: AgencyRequest = {
  code: 'COT-SIEGE', label: 'Cotonou — Siège', address: 'Avenue Steinmetz, Cotonou',
  phone: '+229 21 00 00 00', taxId: null,
};

describe('AgenciesService', () => {
  let service: AgenciesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AgenciesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets all agencies', () => {
    service.getAll().subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets the active agencies', () => {
    service.getActive().subscribe();

    const req = httpTesting.expectOne(`${URL}/active`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets one agency by id', () => {
    service.getById('g1').subscribe();

    const req = httpTesting.expectOne(`${URL}/g1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates an agency', () => {
    service.create(body).subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates an agency', () => {
    service.update('g1', body).subscribe();

    const req = httpTesting.expectOne(`${URL}/g1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('activates an agency', () => {
    service.activate('g1').subscribe();

    const req = httpTesting.expectOne(`${URL}/g1/activate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deactivates an agency', () => {
    service.deactivate('g1').subscribe();

    const req = httpTesting.expectOne(`${URL}/g1/deactivate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deletes an agency', () => {
    service.delete('g1').subscribe();

    const req = httpTesting.expectOne(`${URL}/g1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
