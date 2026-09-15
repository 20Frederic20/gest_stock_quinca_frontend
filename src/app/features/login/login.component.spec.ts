import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { CurrentUser } from '../../core/models/user.model';
import { LoginComponent } from './login.component';

const URL = '/api/v1/auth/login';

const manager: CurrentUser = {
  id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'MANAGER',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
};

describe('LoginComponent', () => {
  let httpTesting: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setup(redirect?: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(LoginComponent);
    if (redirect !== undefined) fixture.componentRef.setInput('redirect', redirect);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  /** The backend accepts the login with a cookie and no body, then /me tells who is logged in. */
  function acceptLogin() {
    httpTesting.expectOne(URL).flush(null, { status: 204, statusText: 'No Content' });
    httpTesting.expectOne('/api/v1/auth/me').flush(manager);
  }

  afterEach(() => httpTesting.verify());

  it('requires an identifier and a password', () => {
    const { component } = setup();

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.username.hasError('required')).toBe(true);
    expect(component.form.controls.password.hasError('required')).toBe(true);
    expect(component.form.controls.username.touched).toBe(true);
  });

  it('sends the identifier without surrounding spaces', () => {
    const { component } = setup();
    component.form.setValue({ username: '  awa.dossou ', password: 'secret-123' });

    component.submit();

    expect(httpTesting.expectOne(URL).request.body).toEqual({ username: 'awa.dossou', password: 'secret-123' });
  });

  it('keeps the user and opens the requested page once the login is accepted', () => {
    const { component } = setup('/articles?page=2');
    component.form.setValue({ username: 'awa.dossou', password: 'secret-123' });

    component.submit();
    acceptLogin();

    expect(TestBed.inject(AuthService).user()).toEqual(manager);
    expect(navigate).toHaveBeenCalledWith('/articles?page=2');
  });

  it('opens the home page when no page was requested', () => {
    const { component } = setup();
    component.form.setValue({ username: 'awa.dossou', password: 'secret-123' });

    component.submit();
    acceptLogin();

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('never redirects outside the application', () => {
    for (const redirect of ['https://evil.example', '//evil.example', 'javascript:alert(1)']) {
      TestBed.resetTestingModule();
      const { component } = setup(redirect);
      component.form.setValue({ username: 'awa.dossou', password: 'secret-123' });

      component.submit();
      acceptLogin();

      expect(navigate).toHaveBeenCalledWith('/');
    }
  });

  it('shows the refusal, clears the password and stays on the page', async () => {
    const { fixture, component, element } = setup();
    component.form.setValue({ username: 'awa.dossou', password: 'wrong' });

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 401, message: 'Nom d’utilisateur ou mot de passe incorrect', fieldErrors: null },
      { status: 401, statusText: 'Unauthorized' },
    );
    await fixture.whenStable();

    expect(element.querySelector('.form-error')?.textContent).toContain('Nom d’utilisateur ou mot de passe incorrect');
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.username.value).toBe('awa.dossou');
    expect(component.submitting()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
