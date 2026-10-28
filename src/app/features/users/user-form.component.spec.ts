import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { User } from '../../core/models/user.model';
import { UserFormComponent } from './user-form.component';

const URL = '/api/v1/users';
const at = '2026-09-15T08:00:00';

const agencies: Agency[] = [
  { id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at },
  { id: 'g2', code: 'PKO', label: 'Parakou', address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at },
];

const seller: User = {
  id: 'u2', name: 'Koffi Mensah', username: 'koffi.mensah', role: 'SELLER', discountLimit: 5, active: true,
  agencyId: 'g2', agencyLabel: 'Parakou', createdAt: at, updatedAt: at,
};

const valid = {
  name: 'Awa Dossou', username: 'awa.dossou', password: 'secret-123', role: 'MANAGER' as const, discountLimit: 10, agencyId: 'g1',
};

describe('UserFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(user: User | null) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(UserFormComponent);
    fixture.componentRef.setInput('user', user);
    fixture.componentRef.setInput('agencies', agencies);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts as a seller without any discount when creating, password required', () => {
    const { component, element } = setup(null);

    expect(component.form.getRawValue()).toEqual({
      name: '', username: '', password: '', role: 'SELLER', discountLimit: 0, agencyId: '',
    });
    expect(component.roleLabel()).toBe('Vendeur');
    expect(component.form.controls.password.enabled).toBe(true);
    expect(element.querySelector('#userPassword')).not.toBeNull();
  });

  it('is prefilled with the edited user, without any password field', () => {
    const { component, element } = setup(seller);

    expect(component.form.controls.name.value).toBe('Koffi Mensah');
    expect(component.form.controls.agencyId.value).toBe('g2');
    expect(component.agencyLabel()).toBe('Parakou');
    expect(component.form.controls.password.disabled).toBe(true);
    expect(element.querySelector('#userPassword')).toBeNull();
  });

  it('offers the four roles and the given agencies', () => {
    const { component } = setup(null);

    expect(component.roleOptions().map(o => o.label)).toEqual(['Administrateur', 'Responsable d’agence', 'Vendeur', 'Caissier']);
    expect(component.agencyOptions()).toEqual([
      { id: 'g1', label: 'Cotonou — Siège' },
      { id: 'g2', label: 'Parakou' },
    ]);
  });

  it('applies the backend rules on each field', () => {
    const { component } = setup(null);
    const { controls } = component.form;

    component.form.setValue({ name: '', username: 'ab', password: 'short', role: 'SELLER', discountLimit: 101, agencyId: '' });
    expect(controls.name.hasError('required')).toBe(true);
    expect(controls.username.hasError('minlength')).toBe(true);
    expect(controls.password.hasError('minlength')).toBe(true);
    expect(controls.discountLimit.hasError('max')).toBe(true);
    expect(controls.agencyId.hasError('required')).toBe(true);

    component.form.patchValue({ username: 'awa dossou', discountLimit: -1 });
    expect(controls.username.hasError('pattern')).toBe(true);
    expect(controls.discountLimit.hasError('min')).toBe(true);

    component.form.setValue(valid);
    expect(component.form.valid).toBe(true);
  });

  it('records the chosen role and agency', () => {
    const { component } = setup(null);

    component.onRoleSelected({ id: 'CASHIER', label: 'Caissier' });
    component.onAgencySelected({ id: 'g2', label: 'Parakou' });

    expect(component.form.controls.role.value).toBe('CASHIER');
    expect(component.roleLabel()).toBe('Caissier');
    expect(component.form.controls.agencyId.value).toBe('g2');
    expect(component.agencyLabel()).toBe('Parakou');
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.name.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates a user with a trimmed name and identifier', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ ...valid, name: '  Awa Dossou ', username: ' awa.dossou ' });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(valid);
    req.flush({ ...seller, id: 'u3' });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited user without sending any password', () => {
    const { component, saved } = setup(seller);
    component.form.controls.discountLimit.setValue(8);

    component.submit();

    const req = httpTesting.expectOne(`${URL}/u2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      name: 'Koffi Mensah', username: 'koffi.mensah', role: 'SELLER', discountLimit: 8, agencyId: 'g2',
    });
    req.flush(seller);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue(valid);

    component.submit();

    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'L’identifiant « awa.dossou » est déjà utilisé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toContain('déjà utilisé');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
