import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ArticlePrice } from '../../core/models/article-price.model';
import { Privilege } from '../../core/models/privilege.model';
import { PriceFormComponent } from './price-form.component';

const at = '2026-09-13T11:29:08.779306';
const TODAY = '2026-09-14';

const privileges: Privilege[] = [
  { id: 'p2', label: 'Chantier', isDefault: false, createdAt: at, updatedAt: at },
  { id: 'p1', label: 'Détail', isDefault: true, createdAt: at, updatedAt: at },
];

const scheduled: ArticlePrice = {
  id: 'x1', packagingId: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R',
  packagingUnitCode: 'SAC', packagingQuantity: 50, privilegeId: 'p2', privilegeLabel: 'Chantier',
  unitPrice: 5000, startDate: '2026-12-01', effective: false, createdAt: at, updatedAt: at,
};

describe('PriceFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(price: ArticlePrice | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PriceFormComponent);
    fixture.componentRef.setInput('price', price);
    fixture.componentRef.setInput('packagingId', 'k1');
    fixture.componentRef.setInput('privileges', privileges);
    fixture.componentRef.setInput('today', TODAY);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts on the default privilege, today, and no price when creating', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({ privilegeId: 'p1', unitPrice: null, startDate: TODAY });
    expect(component.privilegeLabel()).toBe('Détail');
    expect(component.form.valid).toBe(false);
  });

  it('is prefilled with the edited price', () => {
    const { component } = setup(scheduled);

    expect(component.form.getRawValue()).toEqual({ privilegeId: 'p2', unitPrice: 5000, startDate: '2026-12-01' });
    expect(component.privilegeLabel()).toBe('Chantier');
  });

  it('offers every privilege', () => {
    const { component } = setup(null);

    expect(component.privilegeOptions()).toEqual([
      { id: 'p2', label: 'Chantier' },
      { id: 'p1', label: 'Détail' },
    ]);
  });

  it('requires a privilege, a price of at least 0 and a start date', () => {
    const { component } = setup(null);
    const { controls } = component.form;

    component.form.setValue({ privilegeId: '', unitPrice: -1, startDate: '' });

    expect(controls.privilegeId.hasError('required')).toBe(true);
    expect(controls.unitPrice.hasError('min')).toBe(true);
    expect(controls.startDate.hasError('required')).toBe(true);

    component.form.setValue({ privilegeId: 'p1', unitPrice: 0, startDate: TODAY });
    expect(component.form.valid).toBe(true);
  });

  it('refuses a new price starting in the past, which would rewrite history', () => {
    const { component } = setup(null);
    const { startDate } = component.form.controls;

    startDate.setValue('2026-09-13');
    expect(startDate.getError('minDate')).toEqual({ min: TODAY });

    startDate.setValue(TODAY);
    expect(startDate.valid).toBe(true);
  });

  it('keeps an edited price in the future, as the backend requires', () => {
    const { component } = setup(scheduled);
    const { startDate } = component.form.controls;

    startDate.setValue(TODAY);
    expect(startDate.getError('minDate')).toEqual({ min: '2026-09-15' });

    startDate.setValue('2026-09-15');
    expect(startDate.valid).toBe(true);
  });

  it('records the chosen privilege', () => {
    const { component } = setup(null);

    component.onPrivilegeSelected({ id: 'p2', label: 'Chantier' });

    expect(component.form.controls.privilegeId.value).toBe('p2');
    expect(component.privilegeLabel()).toBe('Chantier');
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone('/api/v1/packagings/k1/prices');
    expect(component.form.controls.unitPrice.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates the price under the chosen packaging', () => {
    const { component, saved } = setup(null);
    component.form.patchValue({ unitPrice: 5200, startDate: '2027-01-01' });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/packagings/k1/prices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ privilegeId: 'p1', unitPrice: 5200, startDate: '2027-01-01' });
    req.flush(scheduled);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited price', () => {
    const { component, saved } = setup(scheduled);
    component.form.patchValue({ unitPrice: 4900 });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/prices/x1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ privilegeId: 'p2', unitPrice: 4900, startDate: '2026-12-01' });
    req.flush(scheduled);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.patchValue({ unitPrice: 5000 });

    component.submit();

    httpTesting.expectOne('/api/v1/packagings/k1/prices').flush(
      { status: 400, message: 'Un prix existe déjà pour cette grille tarifaire à partir du 2026-09-14', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toContain('Un prix existe déjà');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
