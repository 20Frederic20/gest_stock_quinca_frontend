import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Supplier } from '../../core/models/supplier.model';
import { SupplierFormComponent } from './supplier-form.component';

const cements = {
  id: 'f1', code: 'FOU-001', companyName: 'Ciments du Bénin', address: 'Zone industrielle, Cotonou',
  phone: '+229 21 30 00 00', taxId: '3201900000002', paymentTerms: '30 jours fin de mois', active: true,
} as Supplier;

describe('SupplierFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(supplier: Supplier | null = null) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(SupplierFormComponent);
    fixture.componentRef.setInput('supplier', supplier);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { component: fixture.componentInstance, fixture, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts empty for a new supplier', () => {
    const { component } = setup();

    expect(component.form.getRawValue()).toEqual({
      code: '', companyName: '', phone: '', address: '', taxId: '', paymentTerms: '',
    });
  });

  it('fills itself with the supplier being edited', () => {
    const { component } = setup(cements);

    expect(component.form.getRawValue()).toEqual({
      code: 'FOU-001', companyName: 'Ciments du Bénin', phone: '+229 21 30 00 00',
      address: 'Zone industrielle, Cotonou', taxId: '3201900000002', paymentTerms: '30 jours fin de mois',
    });
  });

  it('requires a code and a company name, within the lengths the backend accepts', () => {
    const { component } = setup();
    const { code, companyName } = component.form.controls;

    expect(code.hasError('required')).toBe(true);
    expect(companyName.hasError('required')).toBe(true);

    code.setValue('A'.repeat(31));
    companyName.setValue('A'.repeat(201));
    expect(code.hasError('maxlength')).toBe(true);
    expect(companyName.hasError('maxlength')).toBe(true);
  });

  it('creates the supplier, sending nothing where nothing was typed', () => {
    const { component, saved } = setup();
    component.form.patchValue({ code: '  FOU-002 ', companyName: '  Quincaillerie Ayi  ' });

    component.submit();

    const request = httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/suppliers');
    expect(request.request.body).toEqual({
      code: 'FOU-002', companyName: 'Quincaillerie Ayi', phone: null, address: null, taxId: null, paymentTerms: null,
    });
    request.flush(cements);

    expect(saved).toHaveBeenCalled();
  });

  it('updates the supplier being edited', () => {
    const { component, saved } = setup(cements);
    component.form.controls.paymentTerms.setValue('Comptant à la livraison');

    component.submit();

    const request = httpTesting.expectOne(r => r.method === 'PUT' && r.url === '/api/v1/suppliers/f1');
    expect(request.request.body).toMatchObject({ code: 'FOU-001', paymentTerms: 'Comptant à la livraison' });
    request.flush(cements);

    expect(saved).toHaveBeenCalled();
  });

  it('shows why the backend refused a code already taken', () => {
    const { component, saved } = setup();
    component.form.patchValue({ code: 'FOU-001', companyName: 'Ciments du Bénin' });

    component.submit();
    httpTesting.expectOne(r => r.method === 'POST').flush(
      { status: 400, message: 'Un fournisseur avec le code FOU-001 existe déjà', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('existe déjà');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });

  it('puts a field refusal on the field the backend names', () => {
    const { component } = setup();
    component.form.patchValue({ code: 'FOU-002', companyName: 'Quincaillerie Ayi' });

    component.submit();
    httpTesting.expectOne(r => r.method === 'POST').flush(
      { message: 'Donnees invalides', fieldErrors: { code: 'Le code est obligatoire' } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.fieldErrors()['code']).toBe('Le code est obligatoire');
  });

  it('sends nothing while the form is invalid', () => {
    const { component } = setup();

    component.submit();

    httpTesting.expectNone(r => r.method === 'POST');
    expect(component.form.controls.code.touched).toBe(true);
  });
});
