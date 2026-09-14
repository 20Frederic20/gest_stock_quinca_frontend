import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UnitsOfMeasureService } from './units-of-measure.service';

describe('UnitsOfMeasureService', () => {
  let service: UnitsOfMeasureService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UnitsOfMeasureService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets all units', () => {
    service.getAll().subscribe();

    const req = httpTesting.expectOne('/api/v1/units-of-measure');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets one unit by id', () => {
    service.getById('u1').subscribe();

    const req = httpTesting.expectOne('/api/v1/units-of-measure/u1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates a unit', () => {
    const body = { code: 'SAC', label: 'Sac' };
    service.create(body).subscribe();

    const req = httpTesting.expectOne('/api/v1/units-of-measure');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates a unit', () => {
    const body = { code: 'SAC', label: 'Sac de 50 kg' };
    service.update('u1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/units-of-measure/u1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('deletes a unit', () => {
    service.delete('u1').subscribe();

    const req = httpTesting.expectOne('/api/v1/units-of-measure/u1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
