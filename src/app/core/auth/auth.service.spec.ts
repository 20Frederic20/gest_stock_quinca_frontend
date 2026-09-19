import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { errorInterceptor } from '../http/error.interceptor';
import { CurrentUser } from '../models/user.model';
import { AuthService } from './auth.service';
import { PERMISSIONS_ENABLED } from './permissions';

const manager: CurrentUser = {
  id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'MANAGER',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
};

const noContent = [null, { status: 204, statusText: 'No Content' }] as const;
const unauthorized = [
  { status: 401, message: 'Authentification requise', fieldErrors: null },
  { status: 401, statusText: 'Unauthorized' },
] as const;

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  /** The backend answers the login with a cookie and no body: the user comes from /me right after. */
  function loginAs(user: CurrentUser) {
    service.login('awa.dossou', 'secret-123').subscribe();
    httpTesting.expectOne('/api/v1/auth/login').flush(...noContent);
    httpTesting.expectOne('/api/v1/auth/me').flush(user);
  }

  it('does not know who is there before the session is checked', () => {
    expect(service.status()).toBe('unknown');
    expect(service.user()).toBeNull();
  });

  it('gets the CSRF cookie first, then restores an open session', async () => {
    const restored = service.restore();

    const csrf = httpTesting.expectOne('/api/v1/auth/csrf');
    expect(csrf.request.method).toBe('GET');
    httpTesting.expectNone('/api/v1/auth/me');
    csrf.flush(...noContent);

    const me = httpTesting.expectOne('/api/v1/auth/me');
    expect(me.request.method).toBe('GET');
    me.flush(manager);
    await restored;

    expect(service.status()).toBe('authenticated');
    expect(service.user()).toEqual(manager);
  });

  it('is anonymous when there is no session', async () => {
    const restored = service.restore();

    httpTesting.expectOne('/api/v1/auth/csrf').flush(...noContent);
    httpTesting.expectOne('/api/v1/auth/me').flush(...unauthorized);
    await restored;

    expect(service.status()).toBe('anonymous');
    expect(service.startupError()).toBeNull();
  });

  it('still checks the session when the CSRF call fails', async () => {
    const restored = service.restore();

    httpTesting.expectOne('/api/v1/auth/csrf').flush(null, { status: 404, statusText: 'Not Found' });
    httpTesting.expectOne('/api/v1/auth/me').flush(manager);
    await restored;

    expect(service.user()).toEqual(manager);
  });

  it('stays usable when the server cannot be reached, and says why', async () => {
    const restored = service.restore();

    httpTesting.expectOne('/api/v1/auth/csrf').flush(null, { status: 0, statusText: 'Unknown Error' });
    httpTesting.expectOne('/api/v1/auth/me').flush(null, { status: 0, statusText: 'Unknown Error' });
    await restored;

    expect(service.status()).toBe('anonymous');
    expect(service.startupError()).toContain('injoignable');
  });

  it('logs in, then loads the user, since the login answers without a body', async () => {
    const loggedIn = firstValueFrom(service.login('awa.dossou', 'secret-123'));

    const login = httpTesting.expectOne('/api/v1/auth/login');
    expect(login.request.method).toBe('POST');
    expect(login.request.body).toEqual({ username: 'awa.dossou', password: 'secret-123' });
    login.flush(...noContent);
    httpTesting.expectOne('/api/v1/auth/me').flush(manager);

    expect(await loggedIn).toEqual(manager);
    expect(service.status()).toBe('authenticated');
    expect(service.user()).toEqual(manager);
  });

  it('stays anonymous when the login is refused, without asking who is there', async () => {
    const loggedIn = firstValueFrom(service.login('awa.dossou', 'wrong'));

    httpTesting.expectOne('/api/v1/auth/login').flush(
      { status: 401, message: 'Nom d’utilisateur ou mot de passe incorrect', fieldErrors: null },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(loggedIn).rejects.toEqual({
      status: 401, message: 'Nom d’utilisateur ou mot de passe incorrect', fieldErrors: {},
    });
    httpTesting.expectNone('/api/v1/auth/me');
    expect(service.user()).toBeNull();
  });

  it('logs out, and forgets the user even if the server call fails', async () => {
    loginAs(manager);

    const loggedOut = firstValueFrom(service.logout(), { defaultValue: undefined });
    const req = httpTesting.expectOne('/api/v1/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 500, statusText: 'Server Error' });
    await loggedOut.catch(() => undefined);

    expect(service.user()).toBeNull();
    expect(service.status()).toBe('anonymous');
  });

  it('applies the role-based rules by default: permissions are enabled unless overridden', () => {
    expect(service.can('users.manage')).toBe(false);

    loginAs({ ...manager, role: 'SELLER' });

    expect(service.can('users.manage')).toBe(false);
    expect(service.can('stock.act', 'other')).toBe(false);
  });

  it('checks the session only once, however many callers wait for it', async () => {
    const first = service.ensureRestored();
    const second = service.ensureRestored();

    httpTesting.expectOne('/api/v1/auth/csrf').flush(...noContent);
    httpTesting.expectOne('/api/v1/auth/me').flush(manager);
    await Promise.all([first, second]);

    expect(service.user()).toEqual(manager);
    // Once known, asking again does not call the backend any more.
    await service.ensureRestored();
    httpTesting.expectNone('/api/v1/auth/me');
  });

  it('does not check the session again when the user is already known', async () => {
    service.setUser(manager);

    await service.ensureRestored();

    httpTesting.expectNone('/api/v1/auth/csrf');
  });
});

describe('AuthService with permissions enabled', () => {
  it('checks a permission for the logged-in user', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    const service = TestBed.inject(AuthService);

    expect(service.can('referential.write')).toBe(false);

    service.setUser(manager);

    expect(service.can('referential.write')).toBe(true);
    expect(service.can('users.manage')).toBe(false);
    expect(service.can('stock.act', 'g1')).toBe(true);
    expect(service.can('stock.act', 'other')).toBe(false);
  });
});
