import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { PendingLine } from '../../core/models/invoice.model';
import { SaleStartComponent } from './sale-start.component';

const credit = (creditAllowed: boolean): CustomerCredit => ({
  customerId: 'c1', customerName: 'Bâtiments Houngbo', creditLimit: creditAllowed ? 500000 : 0, currentBalance: 0,
  remainingCredit: creditAllowed ? 500000 : 0, paymentTermDays: 30, creditAllowed,
});

const houngbo = { id: 'c1', code: 'CLI-001', name: 'Bâtiments Houngbo', privilegeId: 'p1' } as Customer;
const cement: PendingLine = {
  articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
  unitLabel: 'Sac', appliedCoefficient: 50, quantity: 10, discountRate: 0, unitPrice: 5000, vatRate: 0.18,
};

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

  /** Picks the customer: the credit situation and the customer itself, whose grid prices the lines. */
  function chooseHoungbo(component: SaleStartComponent, creditAllowed = false) {
    component.onCustomerSelected({ id: 'c1', label: 'CLI-001 — Bâtiments Houngbo' });
    httpTesting.expectOne('/api/v1/customers/c1/credit').flush(credit(creditAllowed));
    httpTesting.expectOne('/api/v1/customers/c1').flush(houngbo);
  }

  afterEach(() => httpTesting.verify());

  it('starts as a cash invoice, credit locked until a customer is chosen', () => {
    const { component } = setup();

    expect(component.form.getRawValue()).toEqual({
      customerId: '', type: 'INVOICE', creditMode: false, transportAmount: 0,
    });
    expect(component.typeLabel()).toBe('Facture');
    expect(component.form.controls.creditMode.disabled).toBe(true);
  });

  it('offers credit only to a customer allowed to it', () => {
    const { component } = setup();
    const { creditMode } = component.form.controls;

    chooseHoungbo(component, true);
    expect(creditMode.enabled).toBe(true);
    creditMode.setValue(true);

    component.onCustomerSelected({ id: 'c2', label: 'CLI-002 — Awa Dossou' });
    expect(creditMode.value).toBe(false);
    httpTesting.expectOne('/api/v1/customers/c2/credit').flush(credit(false));
    httpTesting.expectOne('/api/v1/customers/c2').flush({ ...houngbo, id: 'c2' });
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
    chooseHoungbo(component, true);
    component.form.controls.creditMode.setValue(true);
    component.onTypeSelected({ id: 'PROFORMA', label: 'Proforma' });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/invoices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      customerId: 'c1', type: 'PROFORMA', creditMode: true, transportAmount: 0, lines: [],
    });
    req.flush({ id: 'i1' });
    expect(navigate).toHaveBeenCalledWith(['/invoices', 'i1'], { replaceUrl: true });
  });

  it('sends the whole sale in one call: its lines, its transport and nothing else', () => {
    const { component } = setup();
    chooseHoungbo(component);
    component.addLine(cement);
    component.addLine({ ...cement, articleId: 'a2', packagingId: 'k2', quantity: 2, discountRate: 10 });
    component.form.controls.transportAmount.setValue(5000);

    component.submit();

    // Only the three fields the backend accepts per line: it prices the sale itself.
    expect(httpTesting.expectOne('/api/v1/invoices').request.body).toEqual({
      customerId: 'c1',
      type: 'INVOICE',
      creditMode: false,
      transportAmount: 5000,
      lines: [
        { packagingId: 'k1', quantity: 10, discountRate: 0 },
        { packagingId: 'k2', quantity: 2, discountRate: 10 },
      ],
    });
  });

  it('shows the totals of the sale being typed, transport included', () => {
    const { component } = setup();
    chooseHoungbo(component);

    component.addLine(cement);
    component.form.controls.transportAmount.setValue(5000);

    expect(component.totals()).toEqual({
      grossAmount: 50000, discountAmount: 0, netAmount: 50000, vatAmount: 9000, totalAmount: 64000,
    });
  });

  it('drops a line that was typed by mistake', () => {
    const { component } = setup();
    chooseHoungbo(component);
    component.addLine(cement);
    component.addLine({ ...cement, articleId: 'a2', designation: 'Fer à béton' });

    component.removeLine(0);

    expect(component.lines().map(line => line.designation)).toEqual(['Fer à béton']);
  });

  it('shows the backend message when the draft is refused, keeping what was typed', () => {
    const { component, navigate } = setup();
    chooseHoungbo(component, false);
    component.addLine(cement);

    component.submit();

    httpTesting.expectOne('/api/v1/invoices').flush(
      { status: 400, message: 'Le client « Bâtiments Houngbo » est désactivé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toContain('désactivé');
    expect(component.saving()).toBe(false);
    expect(component.lines()).toEqual([cement]);
    expect(navigate).not.toHaveBeenCalled();
  });
});
