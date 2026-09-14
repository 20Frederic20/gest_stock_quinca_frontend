import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../http/error.interceptor';
import { Agency } from '../models/agency.model';
import { CURRENT_AGENCY_STORAGE_KEY, CurrentAgencyService } from './current-agency.service';

const URL = '/api/v1/agencies/active';
const at = '2026-09-14T19:00:00';

const headOffice: Agency = {
  id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null,
  active: true, createdAt: at, updatedAt: at,
};
const parakou: Agency = { ...headOffice, id: 'g2', code: 'PKO', label: 'Parakou' };

describe('CurrentAgencyService', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    return TestBed.inject(CurrentAgencyService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('has no agency before the list is loaded', () => {
    const service = setup();

    expect(service.loaded()).toBe(false);
    expect(service.current()).toBeNull();
  });

  it('loads the active agencies and picks the first one by default', () => {
    const service = setup();

    service.refresh();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);

    expect(service.loaded()).toBe(true);
    expect(service.agencies()).toEqual([headOffice, parakou]);
    expect(service.current()).toEqual(headOffice);
  });

  it('remembers the chosen agency across visits', () => {
    const first = setup();
    first.refresh();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);

    first.select('g2');

    expect(first.current()).toEqual(parakou);
    expect(localStorage.getItem(CURRENT_AGENCY_STORAGE_KEY)).toBe('g2');

    TestBed.resetTestingModule();
    const next = setup();
    next.refresh();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);
    expect(next.current()).toEqual(parakou);
  });

  it('falls back to the first active agency when the remembered one is no longer active', () => {
    localStorage.setItem(CURRENT_AGENCY_STORAGE_KEY, 'closed-agency');
    const service = setup();

    service.refresh();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);

    expect(service.current()).toEqual(headOffice);
  });

  it('has no agency when none is active', () => {
    const service = setup();

    service.refresh();
    httpTesting.expectOne(URL).flush([]);

    expect(service.loaded()).toBe(true);
    expect(service.current()).toBeNull();
  });

  it('keeps the previous list and reports the error when the refresh fails', () => {
    const service = setup();
    service.refresh();
    httpTesting.expectOne(URL).flush([headOffice]);

    service.refresh();
    httpTesting.expectOne(URL).flush(
      { status: 500, message: 'Erreur interne', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(service.error()).toBe('Erreur interne');
    expect(service.current()).toEqual(headOffice);
  });

  it('still works when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = setup();
    service.refresh();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);

    service.select('g2');

    expect(service.current()).toEqual(parakou);
  });
});
