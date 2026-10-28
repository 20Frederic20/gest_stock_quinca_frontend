import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PasswordResetFormComponent } from './password-reset-form.component';

const URL = '/api/v1/users/u2/password/reset';

describe('PasswordResetFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PasswordResetFormComponent);
    fixture.componentRef.setInput('userId', 'u2');
    fixture.componentRef.setInput('userName', 'Koffi Mensah');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('requires a password of at least 8 characters, typed twice', () => {
    const { component } = setup();
    const { newPassword, confirmation } = component.form.controls;

    newPassword.setValue('short');
    expect(newPassword.hasError('minlength')).toBe(true);

    newPassword.setValue('new-secret-1');
    confirmation.setValue('new-secret-2');
    expect(component.form.hasError('mismatch')).toBe(true);

    confirmation.setValue('new-secret-1');
    expect(component.form.valid).toBe(true);
  });

  it('says so when both passwords differ, once the confirmation is touched', async () => {
    const { fixture, component, element } = setup();
    component.form.setValue({ newPassword: 'new-secret-1', confirmation: 'new-secret-2' });
    component.form.controls.confirmation.markAsTouched();
    await fixture.whenStable();

    expect(element.textContent).toContain('Les deux mots de passe ne sont pas identiques');
  });

  it('does not call the backend while the form is invalid', () => {
    const { component, saved } = setup();

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.newPassword.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('sends only the new password, then emits saved', () => {
    const { component, saved } = setup();
    component.form.setValue({ newPassword: 'new-secret-1', confirmation: 'new-secret-1' });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newPassword: 'new-secret-1' });
    req.flush(null);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup();
    component.form.setValue({ newPassword: 'new-secret-1', confirmation: 'new-secret-1' });

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 404, message: 'Utilisateur introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.formError()).toBe('Utilisateur introuvable');
    expect(saved).not.toHaveBeenCalled();
  });
});
