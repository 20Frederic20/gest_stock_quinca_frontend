import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CostingService } from './costing.service';

describe('CostingService', () => {
  let service: CostingService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CostingService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets the status', () => {
    service.status().subscribe();

    const req = httpTesting.expectOne('/api/v1/costing/status');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('starts the tracking', () => {
    service.start().subscribe();

    const req = httpTesting.expectOne('/api/v1/costing/start');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('lists initial lots, sending only the defined filters', () => {
    service.initialLots({ missingOnly: true }).subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/costing/initial-lots');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('missingOnly')).toBe('true');
    expect(req.request.params.has('agencyId')).toBe(false);
    expect(req.request.params.has('search')).toBe(false);
    req.flush([]);
  });

  it('lists initial lots with agency and search', () => {
    service.initialLots({ agencyId: 'ag', missingOnly: false, search: 'vis' }).subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/costing/initial-lots');
    expect(req.request.params.get('agencyId')).toBe('ag');
    expect(req.request.params.get('missingOnly')).toBe('false');
    expect(req.request.params.get('search')).toBe('vis');
    req.flush([]);
  });

  it('sets the initial cost of a lot', () => {
    service.setInitialCost('l1', 12.5).subscribe();

    const req = httpTesting.expectOne('/api/v1/costing/initial-lots/l1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ unitCost: 12.5 });
    req.flush({});
  });

  it('gets the last cost of an article in an agency', () => {
    let result: { unitCost: number | null } | undefined;
    service.lastCost('ag', 'art').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/v1/agencies/ag/costing/articles/art/last-cost');
    expect(req.request.method).toBe('GET');
    req.flush({ unitCost: null });
    expect(result).toEqual({ unitCost: null });
  });
});
