import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Customer, CustomerRequest } from '../../core/models/customer.model';
import { Privilege } from '../../core/models/privilege.model';
import { CustomerFormComponent } from './customer-form.component';

const URL = '/api/v1/customers';
const at = '2026-09-15T08:00:00';

const privileges: Privilege[] = [
  { id: 'p1', label: 'Standard', isDefault: true, createdAt: at, updatedAt: at },
  { id: 'p2', label: 'Revendeur', isDefault: false, createdAt: at, updatedAt: at },
];

const reseller: Customer = {
  id: 'c1', code: 'CLI-001', name: 'Quincaillerie du Port', type: 'RESELLER', phone: '+229 97 00 00 01', address: null,
  taxId: null, creditLimit: 500000, paymentTermDays: 30, comment: null, active: true,
  privilegeId: 'p2', privilegeLabel: 'Revendeur', createdAt: at, updatedAt: at,
};

const valid: CustomerRequest = {
  code: 'CLI-002', name: 'Awa Dossou', type: 'INDIVIDUAL', phone: null, address: null, taxId: null,
  creditLimit: 0, paymentTermDays: 0, comment: null, privilegeId: 'p1',
};

const formValue = { ...valid, phone: '', address: '', taxId: '', comment: '' };

describe('CustomerFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(customer: Customer | null, privilegeList = privileges) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(CustomerFormComponent);
    fixture.componentRef.setInput('customer', customer);
    fixture.componentRef.setInput('privileges', privilegeList);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts as an individual paying cash, on the default grid, when creating', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({ ...formValue, code: '', name: '' });
    expect(component.typeLabel()).toBe('Particulier');
    expect(component.privilegeLabel()).toBe('Standard');
  });

  it('gives the default grid once the privileges arrive, without wiping what was typed', () => {
    const { fixture, component } = setup(null, []);
    component.form.controls.name.setValue('Awa Dossou');

    fixture.componentRef.setInput('privileges', privileges);
    fixture.detectChanges();

    expect(component.form.controls.privilegeId.value).toBe('p1');
    expect(component.privilegeLabel()).toBe('Standard');
    expect(component.form.controls.name.value).toBe('Awa Dossou');
  });

  it('is prefilled with the edited customer', () => {
    const { component } = setup(reseller);

    expect(component.form.controls.name.value).toBe('Quincaillerie du Port');
    expect(component.form.controls.creditLimit.value).toBe(500000);
    expect(component.form.controls.privilegeId.value).toBe('p2');
    expect(component.typeLabel()).toBe('Revendeur');
    expect(component.privilegeLabel()).toBe('Revendeur');
  });

  it('offers the four types and the given grids', () => {
    const { component } = setup(null);

    expect(component.typeOptions().map(o => o.label)).toEqual(['Particulier', 'Entreprise', 'Revendeur', 'Organisme public']);
    expect(component.privilegeOptions()).toEqual([
      { id: 'p1', label: 'Standard' },
      { id: 'p2', label: 'Revendeur' },
    ]);
  });

  it('applies the backend rules on each field', () => {
    const { component } = setup(null);
    const { controls } = component.form;

    component.form.setValue({
      ...formValue, code: '', name: 'x'.repeat(201), taxId: 'x'.repeat(31), creditLimit: -1, paymentTermDays: 366, privilegeId: '',
    });
    expect(controls.code.hasError('required')).toBe(true);
    expect(controls.name.hasError('maxlength')).toBe(true);
    expect(controls.taxId.hasError('maxlength')).toBe(true);
    expect(controls.creditLimit.hasError('min')).toBe(true);
    expect(controls.paymentTermDays.hasError('max')).toBe(true);
    expect(controls.privilegeId.hasError('required')).toBe(true);

    component.form.patchValue({ paymentTermDays: 2.5 });
    expect(controls.paymentTermDays.hasError('pattern')).toBe(true);

    component.form.setValue(formValue);
    expect(component.form.valid).toBe(true);
  });

  it('records the chosen type and grid', () => {
    const { component } = setup(null);

    component.onTypeSelected({ id: 'PUBLIC_ENTITY', label: 'Organisme public' });
    component.onPrivilegeSelected({ id: 'p2', label: 'Revendeur' });

    expect(component.form.controls.type.value).toBe('PUBLIC_ENTITY');
    expect(component.typeLabel()).toBe('Organisme public');
    expect(component.form.controls.privilegeId.value).toBe('p2');
    expect(component.privilegeLabel()).toBe('Revendeur');
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.code.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates a customer with trimmed texts and blanks sent as null', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ ...formValue, code: ' CLI-002 ', name: '  Awa Dossou ', phone: '   ' });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(valid);
    req.flush({ ...reseller, id: 'c2' });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited customer', () => {
    const { component, saved } = setup(reseller);
    component.form.controls.paymentTermDays.setValue(45);

    component.submit();

    const req = httpTesting.expectOne(`${URL}/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      code: 'CLI-001', name: 'Quincaillerie du Port', type: 'RESELLER', phone: '+229 97 00 00 01', address: null,
      taxId: null, creditLimit: 500000, paymentTermDays: 45, comment: null, privilegeId: 'p2',
    });
    req.flush(reseller);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ ...formValue, taxId: '3201900000001' });

    component.submit();

    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Un client avec l’IFU 3201900000001 existe déjà', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toContain('existe déjà');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
