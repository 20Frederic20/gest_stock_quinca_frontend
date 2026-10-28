import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Privilege } from '../../core/models/privilege.model';
import { PrivilegeFormComponent } from './privilege-form.component';

const URL = '/api/v1/privileges';
const at = '2026-09-13T11:29:08.779306';

const retail: Privilege = { id: 'p1', label: 'Détail', isDefault: true, createdAt: at, updatedAt: at };
const site: Privilege = { id: 'p2', label: 'Chantier', isDefault: false, createdAt: at, updatedAt: at };

describe('PrivilegeFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(privilege: Privilege | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PrivilegeFormComponent);
    fixture.componentRef.setInput('privilege', privilege);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts empty and not default when creating', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({ label: '', isDefault: false });
    expect(component.form.controls.isDefault.enabled).toBe(true);
  });

  it('is prefilled with the edited privilege', () => {
    const { component } = setup(site);

    expect(component.form.getRawValue()).toEqual({ label: 'Chantier', isDefault: false });
  });

  it('locks the checkbox of the default privilege, which the backend refuses to unset', () => {
    const { component } = setup(retail);

    expect(component.form.controls.isDefault.value).toBe(true);
    expect(component.form.controls.isDefault.disabled).toBe(true);
  });

  it('unlocks the checkbox when another privilege is selected without closing the panel', () => {
    const { fixture, component } = setup(retail);

    fixture.componentRef.setInput('privilege', site);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({ label: 'Chantier', isDefault: false });
    expect(component.form.controls.isDefault.enabled).toBe(true);
  });

  it('requires a label of at most 100 characters', () => {
    const { component } = setup(null);
    const { label } = component.form.controls;

    expect(label.hasError('required')).toBe(true);

    label.setValue('A'.repeat(101));
    expect(label.hasError('maxlength')).toBe(true);
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.label.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates a privilege and emits saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ label: 'Revendeur', isDefault: true });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ label: 'Revendeur', isDefault: true });
    req.flush({ ...site, id: 'p9', label: 'Revendeur' });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('keeps the default flag when renaming the default privilege', () => {
    const { component, saved } = setup(retail);
    component.form.controls.label.setValue('Détail comptoir');

    component.submit();

    const req = httpTesting.expectOne(`${URL}/p1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ label: 'Détail comptoir', isDefault: true });
    req.flush(retail);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ label: 'Chantier', isDefault: false });

    component.submit();

    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Un privilège nommé « Chantier » existe déjà', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toBe('Un privilège nommé « Chantier » existe déjà');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
