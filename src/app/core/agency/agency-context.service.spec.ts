import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { errorInterceptor } from '../http/error.interceptor';
import { CurrentUser } from '../models/user.model';
import { AgencyContextService } from './agency-context.service';

const cotonou = { id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null, active: true, createdAt: '', updatedAt: '' };
const porto = { ...cotonou, id: 'g2', code: 'PTN-SIEGE', label: 'Porto-Novo — Siège' };

const user = (agencyId: string, agencyLabel: string, id = 'u1'): CurrentUser => ({
  id, name: 'Test', username: 'test', role: 'SELLER', agencyId, agencyLabel,
});

describe('AgencyContextService', () => {
  let httpTesting: HttpTestingController;
  let auth: AuthService;
  let service: AgencyContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    service = TestBed.inject(AgencyContextService);
  });

  afterEach(() => httpTesting.verify());

  it('stays empty until a user is known', () => {
    service.ensureLoaded();
    expect(service.viewedAgencyId()).toBe('');
  });

  it('loads the active agencies once and starts on the user’s own agency', () => {
    auth.setUser(user('g1', 'Cotonou — Siège'));

    service.ensureLoaded();
    expect(service.viewedAgencyId()).toBe('g1');

    httpTesting.expectOne('/api/v1/agencies/active').flush([cotonou, porto]);

    expect(service.agencyOptions().map(o => o.label)).toEqual(['Cotonou — Siège', 'Porto-Novo — Siège']);
    expect(service.canSwitch()).toBe(true);

    // A second call (e.g. another screen mounting) does not fetch the list again.
    service.ensureLoaded();
  });

  it('falls back to the user’s own agency label before the list has loaded', () => {
    auth.setUser(user('g1', 'Cotonou — Siège'));
    service.ensureLoaded();

    expect(service.viewedAgencyLabel()).toBe('Cotonou — Siège');
    httpTesting.expectOne('/api/v1/agencies/active').flush([]);
  });

  it('does not offer a switch with a single agency', () => {
    auth.setUser(user('g1', 'Cotonou — Siège'));
    service.ensureLoaded();
    httpTesting.expectOne('/api/v1/agencies/active').flush([cotonou]);

    expect(service.canSwitch()).toBe(false);
  });

  it('changes the viewed agency, ignoring an empty id', () => {
    auth.setUser(user('g1', 'Cotonou — Siège'));
    service.ensureLoaded();
    httpTesting.expectOne('/api/v1/agencies/active').flush([cotonou, porto]);

    service.select('g2');
    expect(service.viewedAgencyId()).toBe('g2');

    service.select('');
    expect(service.viewedAgencyId()).toBe('g2');
  });

  it('resets to the user’s own agency', () => {
    auth.setUser(user('g1', 'Cotonou — Siège'));
    service.ensureLoaded();
    httpTesting.expectOne('/api/v1/agencies/active').flush([cotonou, porto]);

    service.select('g2');
    service.resetToHome();

    expect(service.viewedAgencyId()).toBe('g1');
  });

  it('starts over for a different user in the same tab', () => {
    auth.setUser(user('g1', 'Cotonou — Siège', 'u1'));
    service.ensureLoaded();
    httpTesting.expectOne('/api/v1/agencies/active').flush([cotonou, porto]);

    service.select('g2');

    // A different user, whose own agency is the first one again: proves the reset is
    // driven by the new login, not just a leftover value from the previous choice.
    auth.setUser(user('g1', 'Cotonou — Siège', 'u2'));
    service.ensureLoaded();

    // The list is not fetched again; only the viewed agency moves to the new user's own.
    expect(service.viewedAgencyId()).toBe('g1');
  });
});
