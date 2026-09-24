import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { Invoice, PendingLine } from '../../core/models/invoice.model';
import { Privilege } from '../../core/models/privilege.model';
import { Payment } from '../../core/models/payment.model';
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

const created = { id: 'i1', number: 'FAC-COT-2026-00001', status: 'DRAFT' } as Invoice;
const validated = { ...created, status: 'VALIDATED', totalAmount: 59000, paidAmount: 0, remainingToPay: 59000 } as Invoice;

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
      customerId: '', walkInCustomerName: '', type: 'INVOICE', creditMode: false, transportAmount: 0,
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
      customerId: 'c1', walkInCustomerName: null, type: 'PROFORMA', creditMode: true, transportAmount: 0, lines: [],
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
      walkInCustomerName: null,
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

  it('creates, validates and offers to collect in one move', () => {
    const { component, navigate } = setup();
    chooseHoungbo(component);
    component.addLine(cement);

    component.submitAndCollect();

    httpTesting.expectOne('/api/v1/invoices').flush(created);
    const validation = httpTesting.expectOne('/api/v1/invoices/i1/validation');
    expect(validation.request.method).toBe('POST');
    validation.flush(validated);

    // The drawer opens on what the invoice owes, without leaving the screen.
    expect(component.collecting()?.remainingToPay).toBe(59000);
    expect(component.saving()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the document once the payment is taken', () => {
    const { component, navigate } = setup();
    chooseHoungbo(component);
    component.submitAndCollect();
    httpTesting.expectOne('/api/v1/invoices').flush(created);
    httpTesting.expectOne('/api/v1/invoices/i1/validation').flush(validated);

    component.onPaymentTaken({ id: 'p1', invoiceId: 'i1' } as Payment);

    expect(navigate).toHaveBeenCalledWith(['/invoices', 'i1'], { replaceUrl: true });
  });

  it('opens the document all the same when the collection is put off', () => {
    const { component, navigate } = setup();
    chooseHoungbo(component);
    component.submitAndCollect();
    httpTesting.expectOne('/api/v1/invoices').flush(created);
    httpTesting.expectOne('/api/v1/invoices/i1/validation').flush(validated);

    component.closePayment();

    expect(navigate).toHaveBeenCalledWith(['/invoices', 'i1'], { replaceUrl: true });
  });

  it('stops on the document it just created when the validation is refused', () => {
    const { component, navigate } = setup();
    chooseHoungbo(component);
    component.submitAndCollect();
    httpTesting.expectOne('/api/v1/invoices').flush(created);

    httpTesting.expectOne('/api/v1/invoices/i1/validation').flush(
      { status: 400, message: 'Stock insuffisant pour « Ciment CIM II 32.5R »', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    // The document exists: it must not be lost, nor silently left behind.
    expect(component.formError()).toContain('Stock insuffisant');
    expect(component.created()?.number).toBe('FAC-COT-2026-00001');
    expect(component.collecting()).toBeNull();
    expect(component.saving()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
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

  describe('walk-in customer ("Autre")', () => {
    const defaultPrivilege: Privilege = { id: 'p9', label: 'Grand public', isDefault: true } as Privilege;

    it('unblocks the articles from the default price grid, cash only, once toggled on', () => {
      const { component } = setup();

      component.toggleOtherCustomer(true);
      httpTesting.expectOne('/api/v1/privileges/default').flush(defaultPrivilege);

      expect(component.activePrivilegeId()).toBe('p9');
      expect(component.form.controls.customerId.valid).toBe(true);
      expect(component.form.controls.creditMode.disabled).toBe(true);
    });

    it('drops the chosen customer and its lines when switched to a walk-in sale', () => {
      const { component } = setup();
      chooseHoungbo(component, true);
      component.addLine(cement);

      component.toggleOtherCustomer(true);
      httpTesting.expectOne('/api/v1/privileges/default').flush(defaultPrivilege);

      expect(component.chosen()).toBeNull();
      expect(component.lines()).toEqual([]);
      expect(component.credit()).toBeNull();
    });

    it('restores the customer field, required again, when switched back off', () => {
      const { component } = setup();

      component.toggleOtherCustomer(true);
      httpTesting.expectOne('/api/v1/privileges/default').flush(defaultPrivilege);
      component.toggleOtherCustomer(false);

      expect(component.activePrivilegeId()).toBeNull();
      component.submit();
      expect(component.form.controls.customerId.touched).toBe(true);
      httpTesting.expectNone('/api/v1/invoices');
    });

    it('sends no customer, an optional name, and forces a cash sale', () => {
      const { component, navigate } = setup();

      component.toggleOtherCustomer(true);
      httpTesting.expectOne('/api/v1/privileges/default').flush(defaultPrivilege);
      component.form.controls.walkInCustomerName.setValue('Amina D.');
      component.addLine(cement);

      component.submit();

      const req = httpTesting.expectOne('/api/v1/invoices');
      expect(req.request.body).toEqual({
        customerId: null,
        walkInCustomerName: 'Amina D.',
        type: 'INVOICE',
        creditMode: false,
        transportAmount: 0,
        lines: [{ packagingId: 'k1', quantity: 10, discountRate: 0 }],
      });
      req.flush({ id: 'i9', customerId: null, customerName: 'Amina D.' });
      expect(navigate).toHaveBeenCalledWith(['/invoices', 'i9'], { replaceUrl: true });
    });

    it('leaves the name empty when none is given', () => {
      const { component } = setup();

      component.toggleOtherCustomer(true);
      httpTesting.expectOne('/api/v1/privileges/default').flush(defaultPrivilege);
      component.addLine(cement);

      component.submit();

      const req = httpTesting.expectOne('/api/v1/invoices');
      expect(req.request.body).toEqual(
        expect.objectContaining({ customerId: null, walkInCustomerName: null }),
      );
      req.flush({ id: 'i9', customerId: null, customerName: 'Client de passage' });
    });
  });
});
