import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Packaging } from '../../core/models/packaging.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { PackagingFormComponent } from './packaging-form.component';

const at = '2026-09-13T11:32:32.423855';

const units: UnitOfMeasure[] = [
  { id: 'u1', code: 'KG', label: 'Kilogramme', createdAt: at, updatedAt: at },
  { id: 'u2', code: 'SAC', label: 'Sac', createdAt: at, updatedAt: at },
];

const bag: Packaging = {
  id: 'p1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R',
  unitId: 'u2', unitCode: 'SAC', unitLabel: 'Sac', quantity: 50,
  defaultPurchase: false, defaultSale: true, createdAt: at, updatedAt: at,
};

describe('PackagingFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(packaging: Packaging | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PackagingFormComponent);
    fixture.componentRef.setInput('packaging', packaging);
    fixture.componentRef.setInput('articleId', 'a1');
    fixture.componentRef.setInput('units', units);
    fixture.componentRef.setInput('stockUnitCode', 'KG');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts with a quantity of 1 and no default flag when creating', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({
      unitId: '', quantity: 1, defaultPurchase: false, defaultSale: false,
    });
    expect(component.form.valid).toBe(false);
  });

  it('is prefilled with the edited packaging', () => {
    const { component } = setup(bag);

    expect(component.form.getRawValue()).toEqual({
      unitId: 'u2', quantity: 50, defaultPurchase: false, defaultSale: true,
    });
    expect(component.unitLabel()).toBe('SAC — Sac');
  });

  it('reloads when another packaging is selected without closing the panel', () => {
    const { fixture, component } = setup(bag);

    fixture.componentRef.setInput('packaging', { ...bag, id: 'p2', unitId: 'u1', unitCode: 'KG', unitLabel: 'Kilogramme', quantity: 1 });
    fixture.detectChanges();

    expect(component.form.controls.quantity.value).toBe(1);
    expect(component.unitLabel()).toBe('KG — Kilogramme');
  });

  it('requires a unit and a strictly positive quantity', () => {
    const { component } = setup(null);
    const { controls } = component.form;

    component.form.patchValue({ quantity: 0 });

    expect(controls.unitId.hasError('required')).toBe(true);
    expect(controls.quantity.hasError('min')).toBe(true);

    component.form.patchValue({ quantity: 0.0001 });
    expect(controls.quantity.valid).toBe(true);
  });

  it('records the chosen unit', () => {
    const { component } = setup(null);

    component.onUnitSelected({ id: 'u1', label: 'KG — Kilogramme' });

    expect(component.form.controls.unitId.value).toBe('u1');
    expect(component.unitLabel()).toBe('KG — Kilogramme');
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone('/api/v1/articles/a1/packagings');
    expect(component.form.controls.unitId.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates the packaging under the chosen article', () => {
    const { component, saved } = setup(null);
    component.onUnitSelected({ id: 'u2', label: 'SAC — Sac' });
    component.form.patchValue({ quantity: 50, defaultSale: true });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/articles/a1/packagings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ unitId: 'u2', quantity: 50, defaultPurchase: false, defaultSale: true });
    req.flush(bag);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited packaging', () => {
    const { component, saved } = setup(bag);
    component.form.patchValue({ quantity: 25, defaultSale: false });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/packagings/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ unitId: 'u2', quantity: 25, defaultPurchase: false, defaultSale: false });
    req.flush(bag);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup(bag);

    component.submit();

    httpTesting.expectOne('/api/v1/packagings/p1').flush(
      { status: 400, message: 'Ce conditionnement existe déjà pour cet article', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toBe('Ce conditionnement existe déjà pour cet article');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
