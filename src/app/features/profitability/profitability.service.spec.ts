import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfitabilityService } from './profitability.service';

describe('ProfitabilityService', () => {
  let service: ProfitabilityService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProfitabilityService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets the report without agency', () => {
    service.get('2026-01-01', '2026-01-31').subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/reports/profitability');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-01-31');
    expect(req.request.params.has('agencyId')).toBe(false);
    req.flush({});
  });

  it('gets the report for one agency', () => {
    service.get('2026-01-01', '2026-01-31', 'ag').subscribe();

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/reports/profitability');
    expect(req.request.params.get('agencyId')).toBe('ag');
    req.flush({});
  });

  it('downloads the xlsx with the filename of the backend', () => {
    let result: { blob: Blob; filename: string } | undefined;
    service.download('xlsx', '2026-01-01', '2026-01-31', 'ag').subscribe((r) => (result = r));

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/reports/profitability/xlsx');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('agencyId')).toBe('ag');
    req.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="rentabilite.xlsx"' } });
    expect(result?.filename).toBe('rentabilite.xlsx');
    expect(result?.blob).toBeInstanceOf(Blob);
  });

  it('downloads the pdf, with a fallback filename', () => {
    let result: { blob: Blob; filename: string } | undefined;
    service.download('pdf', '2026-01-01', '2026-01-31').subscribe((r) => (result = r));

    const req = httpTesting.expectOne((r) => r.url === '/api/v1/reports/profitability/pdf');
    expect(req.request.params.has('agencyId')).toBe(false);
    req.flush(new Blob(['x']));
    expect(result?.filename).toBe('rentabilite-2026-01-01-2026-01-31.pdf');
  });
});
