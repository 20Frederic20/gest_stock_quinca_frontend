import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { UnitOfMeasureFormComponent } from './unit-of-measure-form.component';

const bag: UnitOfMeasure = {
  id: 'u1', code: 'SAC', label: 'Sac', createdAt: '2026-09-01T08:00:00', updatedAt: '2026-09-01T08:00:00',
};
const kilogram: UnitOfMeasure = {
  id: 'u2', code: 'KG', label: 'Kilogramme', createdAt: '2026-09-01T08:00:00', updatedAt: '2026-09-01T08:00:00',
};

describe('UnitOfMeasureFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(unit: UnitOfMeasure | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(UnitOfMeasureFormComponent);
    fixture.componentRef.setInput('unit', unit);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts empty when creating a unit', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({ code: '', label: '' });
  });

  it('is prefilled with the unit being edited', () => {
    const { component } = setup(bag);

    expect(component.form.getRawValue()).toEqual({ code: 'SAC', label: 'Sac' });
  });

  it('reloads when another unit is selected without closing the panel', () => {
    const { fixture, component } = setup(bag);

    fixture.componentRef.setInput('unit', kilogram);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({ code: 'KG', label: 'Kilogramme' });
  });

  it('refuses a code longer than 20 characters', () => {
    const { component } = setup(null);

    component.form.setValue({ code: 'A'.repeat(21), label: 'Sac' });

    expect(component.form.controls.code.hasError('maxlength')).toBe(true);
  });

  it('refuses a label longer than 100 characters', () => {
    const { component } = setup(null);

    component.form.setValue({ code: 'SAC', label: 'A'.repeat(101) });

    expect(component.form.controls.label.hasError('maxlength')).toBe(true);
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone('/api/v1/units-of-measure');
    expect(component.form.controls.code.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates a unit and emits saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ code: 'SAC', label: 'Sac' });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/units-of-measure');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: 'SAC', label: 'Sac' });
    req.flush(bag);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited unit and emits saved', () => {
    const { component, saved } = setup(bag);
    component.form.controls.label.setValue('Sac de 50 kg');

    component.submit();

    const req = httpTesting.expectOne('/api/v1/units-of-measure/u1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ code: 'SAC', label: 'Sac de 50 kg' });
    req.flush({ ...bag, label: 'Sac de 50 kg' });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('keeps the backend field errors and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ code: 'SAC', label: 'Sac' });

    component.submit();

    httpTesting.expectOne('/api/v1/units-of-measure').flush(
      { status: 400, message: 'Donnees invalides', fieldErrors: { code: 'Ce code existe déjà' } },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.fieldErrors()['code']).toBe('Ce code existe déjà');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
