import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { SaleStartComponent } from './sale-start.component';

const credit = (creditAllowed: boolean): CustomerCredit => ({
  customerId: 'c1', customerName: 'Bâtiments Houngbo', creditLimit: creditAllowed ? 500000 : 0, currentBalance: 0,
  remainingCredit: creditAllowed ? 500000 : 0, paymentTermDays: 30, creditAllowed,
});

describe('SaleStartComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'SELLER', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(SaleStartComponent);
    fixture.detectChanges();

    return { component: fixture.componentInstance, navigate };
  }

  afterEach(() => httpTesting.verify());

  it('starts as a cash invoice, credit locked until a customer is chosen', () => {
    const { component } = setup();

    expect(component.form.getRawValue()).toEqual({ customerId: '', type: 'INVOICE', creditMode: false });
    expect(component.typeLabel()).toBe('Facture');
    expect(component.form.controls.creditMode.disabled).toBe(true);
  });

  it('offers credit only to a customer allowed to it', () => {
    const { component } = setup();
    const { creditMode } = component.form.controls;

    component.onCustomerSelected({ id: 'c1', label: 'CLI-001 — Bâtiments Houngbo' });
    httpTesting.expectOne('/api/v1/customers/c1/credit').flush(credit(true));
    expect(creditMode.enabled).toBe(true);
    creditMode.setValue(true);

    component.onCustomerSelected({ id: 'c2', label: 'CLI-002 — Awa Dossou' });
    expect(creditMode.value).toBe(false);
    httpTesting.expectOne('/api/v1/customers/c2/credit').flush(credit(false));
    expect(creditMode.disabled).toBe(true);
  });

  it('only proposes active customers', () => {
    const { component } = setup();
    let options: unknown;
    const customer = (id: string, active: boolean) => ({ id, code: `CLI-${id}`, name: `Client ${id}`, active }) as Customer;

    component.searchCustomers(' bat ').subscribe(result => (options = result));

    const req = httpTesting.expectOne(r => r.url === '/api/v1/customers/search');
    expect(req.request.params.get('term')).toBe('bat');
    req.flush({ content: [customer('1', true), customer('2', false)], totalElements: 2, totalPages: 1, number: 0, size: 20 });
    expect(options).toEqual([{ id: '1', label: 'CLI-1 — Client 1' }]);
  });

  it('does not create anything without a customer', () => {
    const { component } = setup();

    component.submit();

    httpTesting.expectNone('/api/v1/invoices');
    expect(component.form.controls.customerId.touched).toBe(true);
  });

  it('creates the draft, then opens it in place of this step', () => {
    const { component, navigate } = setup();
    component.onCustomerSelected({ id: 'c1', label: 'CLI-001 — Bâtiments Houngbo' });
    httpTesting.expectOne('/api/v1/customers/c1/credit').flush(credit(true));
    component.form.controls.creditMode.setValue(true);
    component.onTypeSelected({ id: 'PROFORMA', label: 'Proforma' });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/invoices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ customerId: 'c1', type: 'PROFORMA', creditMode: true });
    req.flush({ id: 'i1' });
    expect(navigate).toHaveBeenCalledWith(['/invoices', 'i1'], { replaceUrl: true });
  });

  it('shows the backend message when the draft is refused', () => {
    const { component, navigate } = setup();
    component.onCustomerSelected({ id: 'c1', label: 'CLI-001 — Bâtiments Houngbo' });
    httpTesting.expectOne('/api/v1/customers/c1/credit').flush(credit(false));

    component.submit();

    httpTesting.expectOne('/api/v1/invoices').flush(
      { status: 400, message: 'Le client « Bâtiments Houngbo » est désactivé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toContain('désactivé');
    expect(component.saving()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
