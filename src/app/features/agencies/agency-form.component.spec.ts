import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { AgencyFormComponent } from './agency-form.component';

const URL = '/api/v1/agencies';
const at = '2026-09-14T19:00:00';

const headOffice: Agency = {
  id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: 'Avenue Steinmetz, Cotonou',
  phone: '+229 21 00 00 00', taxId: '3201900000001', active: true, createdAt: at, updatedAt: at,
};
const parakou: Agency = {
  id: 'g2', code: 'PKO', label: 'Parakou', address: null, phone: null, taxId: null,
  active: true, createdAt: at, updatedAt: at,
};

const valid = { code: 'PNO', label: 'Porto-Novo', address: '', phone: '', taxId: '' };

describe('AgencyFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(agency: Agency | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(AgencyFormComponent);
    fixture.componentRef.setInput('agency', agency);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts empty when creating', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({ code: '', label: '', address: '', phone: '', taxId: '' });
    expect(component.form.valid).toBe(false);
  });

  it('is prefilled with the edited agency, missing fields as empty text', () => {
    const { component } = setup(parakou);

    expect(component.form.getRawValue()).toEqual({ code: 'PKO', label: 'Parakou', address: '', phone: '', taxId: '' });
  });

  it('reloads when another agency is selected without closing the panel', () => {
    const { fixture, component } = setup(parakou);

    fixture.componentRef.setInput('agency', headOffice);
    fixture.detectChanges();

    expect(component.form.controls.taxId.value).toBe('3201900000001');
  });

  it('requires a code and a label, and applies the backend lengths', () => {
    const { component } = setup(null);
    const { controls } = component.form;

    expect(controls.code.hasError('required')).toBe(true);
    expect(controls.label.hasError('required')).toBe(true);

    component.form.setValue({
      code: 'A'.repeat(21), label: 'A'.repeat(151), address: 'A'.repeat(256), phone: '1'.repeat(31), taxId: '1'.repeat(31),
    });

    expect(controls.code.hasError('maxlength')).toBe(true);
    expect(controls.label.hasError('maxlength')).toBe(true);
    expect(controls.address.hasError('maxlength')).toBe(true);
    expect(controls.phone.hasError('maxlength')).toBe(true);
    expect(controls.taxId.hasError('maxlength')).toBe(true);
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.code.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates an agency, sending blank optional fields as null and trimming the others', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ ...valid, phone: '  +229 20 00 00 00 ', taxId: '   ' });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      code: 'PNO', label: 'Porto-Novo', address: null, phone: '+229 20 00 00 00', taxId: null,
    });
    req.flush({ ...parakou, id: 'g3' });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited agency', () => {
    const { component, saved } = setup(headOffice);
    component.form.controls.phone.setValue('+229 21 11 11 11');

    component.submit();

    const req = httpTesting.expectOne(`${URL}/g1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      code: 'COT-SIEGE', label: 'Cotonou — Siège', address: 'Avenue Steinmetz, Cotonou',
      phone: '+229 21 11 11 11', taxId: '3201900000001',
    });
    req.flush(headOffice);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue(valid);

    component.submit();

    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Une agence avec le code PNO existe déjà', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toBe('Une agence avec le code PNO existe déjà');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
