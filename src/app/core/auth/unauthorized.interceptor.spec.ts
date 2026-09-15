import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { errorInterceptor } from '../http/error.interceptor';
import { AuthService } from './auth.service';
import { unauthorizedInterceptor } from './unauthorized.interceptor';

const unauthorized = [
  { status: 401, message: 'Vous devez vous connecter', fieldErrors: null },
  { status: 401, statusText: 'Unauthorized' },
] as const;

describe('unauthorizedInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, unauthorizedInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.setUser({ id: 'u1', name: 'Test', username: 'test', role: 'SELLER', agencyId: 'g1', agencyLabel: 'Cotonou' });
  });

  afterEach(() => httpTesting.verify());

  it('forgets the user and sends them to the login page when the session has expired', () => {
    const error = vi.fn();
    http.get('/api/v1/articles').subscribe({ error });

    httpTesting.expectOne('/api/v1/articles').flush(...unauthorized);

    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toMatch(/^\/login/);
    // The screen still receives the error, already turned into an ApiError.
    expect(error).toHaveBeenCalledWith({ status: 401, message: 'Vous devez vous connecter', fieldErrors: {} });
  });

  it('leaves the refused login to the login page', () => {
    http.post('/api/v1/auth/login', {}).subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/v1/auth/login').flush(...unauthorized);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves the startup session check alone', () => {
    http.get('/api/v1/auth/me').subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/v1/auth/me').flush(...unauthorized);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves the startup CSRF call alone', () => {
    http.get('/api/v1/auth/csrf').subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/v1/auth/csrf').flush(...unauthorized);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does nothing on a forbidden action', () => {
    http.delete('/api/v1/users/u2').subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/v1/users/u2').flush(
      { status: 403, message: 'Vous n’avez pas les droits pour cette action', fieldErrors: null },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(auth.user()).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
