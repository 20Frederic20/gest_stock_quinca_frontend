import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { CurrentUser, Role } from '../models/user.model';
import { authGuard, guestGuard, permissionGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { PERMISSIONS_ENABLED } from './permissions';

const user = (role: Role): CurrentUser => ({
  id: 'u1', name: 'Test', username: 'test', role, agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
});

describe('auth guards', () => {
  let auth: AuthService;
  let router: Router;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const run = (guard: typeof authGuard, url: string) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  const serialize = (result: unknown) => router.serializeUrl(result as UrlTree);

  it('sends an anonymous visitor to the login page, remembering where they were going', async () => {
    auth.setUser(null);

    expect(serialize(await run(authGuard, '/articles?page=2'))).toBe('/login?redirect=%2Farticles%3Fpage%3D2');
  });

  it('lets a logged-in user through', async () => {
    auth.setUser(user('SELLER'));

    expect(await run(authGuard, '/articles')).toBe(true);
  });

  it('sends a logged-in user away from the login page, to the dashboard', async () => {
    auth.setUser(user('SELLER'));

    expect(serialize(await run(guestGuard, '/login'))).toBe('/dashboard');
  });

  it('shows the login page to an anonymous visitor', async () => {
    auth.setUser(null);

    expect(await run(guestGuard, '/login')).toBe(true);
  });

  it('waits for the session check before deciding, when it is not done yet', async () => {
    const decision = run(authGuard, '/articles');

    httpTesting.expectOne('/api/v1/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    httpTesting.expectOne('/api/v1/auth/me').flush(user('SELLER'));

    expect(await decision).toBe(true);
  });

  it('does not check the session twice when several screens ask at once', async () => {
    const first = run(authGuard, '/articles');
    const second = run(guestGuard, '/login');

    // One check only, whoever asked first.
    httpTesting.expectOne('/api/v1/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    httpTesting.expectOne('/api/v1/auth/me').flush(user('SELLER'));

    expect(await first).toBe(true);
    expect(serialize(await second)).toBe('/dashboard');
  });

  it('only opens a screen to the roles allowed on it', () => {
    const usersGuard = permissionGuard('users.manage');

    auth.setUser(user('ADMIN'));
    expect(run(usersGuard, '/users')).toBe(true);

    auth.setUser(user('MANAGER'));
    expect(serialize(run(usersGuard, '/users'))).toBe('/dashboard');
  });
});
