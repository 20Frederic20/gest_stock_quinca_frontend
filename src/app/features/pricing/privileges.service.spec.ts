import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PrivilegesService } from './privileges.service';

const URL = '/api/v1/privileges';

describe('PrivilegesService', () => {
  let service: PrivilegesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PrivilegesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets all privileges', () => {
    service.getAll().subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets the default privilege', () => {
    service.getDefault().subscribe();

    const req = httpTesting.expectOne(`${URL}/default`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('gets one privilege by id', () => {
    service.getById('p1').subscribe();

    const req = httpTesting.expectOne(`${URL}/p1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates a privilege', () => {
    const body = { label: 'Revendeur', isDefault: false };
    service.create(body).subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates a privilege', () => {
    const body = { label: 'Revendeur agréé', isDefault: true };
    service.update('p1', body).subscribe();

    const req = httpTesting.expectOne(`${URL}/p1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('marks a privilege as the default', () => {
    service.setDefault('p1').subscribe();

    const req = httpTesting.expectOne(`${URL}/p1/default`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deletes a privilege', () => {
    service.delete('p1').subscribe();

    const req = httpTesting.expectOne(`${URL}/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
