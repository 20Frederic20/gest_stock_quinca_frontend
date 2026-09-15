import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
  });

  const run = (guard: typeof authGuard, url: string) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  const serialize = (result: unknown) => router.serializeUrl(result as UrlTree);

  it('sends an anonymous visitor to the login page, remembering where they were going', () => {
    auth.setUser(null);

    expect(serialize(run(authGuard, '/articles?page=2'))).toBe('/login?redirect=%2Farticles%3Fpage%3D2');
  });

  it('lets a logged-in user through', () => {
    auth.setUser(user('SELLER'));

    expect(run(authGuard, '/articles')).toBe(true);
  });

  it('sends a logged-in user away from the login page', () => {
    auth.setUser(user('SELLER'));

    expect(serialize(run(guestGuard, '/login'))).toBe('/');
  });

  it('shows the login page to an anonymous visitor', () => {
    auth.setUser(null);

    expect(run(guestGuard, '/login')).toBe(true);
  });

  it('only opens a screen to the roles allowed on it', () => {
    const usersGuard = permissionGuard('users.manage');

    auth.setUser(user('ADMIN'));
    expect(run(usersGuard, '/users')).toBe(true);

    auth.setUser(user('MANAGER'));
    expect(serialize(run(usersGuard, '/users'))).toBe('/');
  });
});
