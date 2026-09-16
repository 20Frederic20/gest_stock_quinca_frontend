import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { Invoice, InvoiceLine } from '../../core/models/invoice.model';
import { Payment } from '../../core/models/payment.model';
import { AgencyStock } from '../../core/models/stock.model';
import { Role } from '../../core/models/user.model';
import { InvoicePageComponent } from './invoice-page.component';

const at = '2026-09-15T08:00:00';
const line: InvoiceLine = {
  id: 'l1', articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1', unitLabel: 'Sac', appliedCoefficient: 50,
  quantity: 10, deliveredQuantity: 0, remainingToDeliver: 10, unitPrice: 5000, discountRate: 0, discountAmount: 0,
  vatRate: 0.18, netAmount: 50000, vatAmount: 9000, totalAmount: 59000,
};
const draft: Invoice = {
  id: 'i1', number: 'FAC-COT-2026-00001', type: 'INVOICE', status: 'DRAFT', deliveryStatus: 'NOT_DELIVERED',
  documentDate: '2026-09-15', dueDate: null, grossAmount: 50000, discountAmount: 0, netAmount: 50000, vatAmount: 9000,
  transportAmount: 0, totalAmount: 59000, paidAmount: 0, remainingToPay: 59000, creditMode: false, cancellationReason: null,
  customerId: 'c1', customerName: 'Bâtiments Houngbo', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
  userId: 'u1', userName: 'Awa Dossou', lines: [line], createdAt: at,
};
const validated: Invoice = { ...draft, status: 'VALIDATED' };
const customer = {
  id: 'c1', code: 'CLI-001', name: 'Bâtiments Houngbo', phone: null, privilegeId: 'p1', privilegeLabel: 'Standard',
} as Customer;
const credit = {
  customerId: 'c1', creditLimit: 200000, currentBalance: 150000, remainingCredit: 50000, creditAllowed: true,
} as CustomerCredit;
const stock = { articleId: 'a1', stockUnitCode: 'KG', availableQuantity: 5000 } as AgencyStock;

describe('InvoicePageComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(invoice: Invoice = draft, role: Role = 'ADMIN') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u9', name: 'Test', username: 'test', role, agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(InvoicePageComponent);
    fixture.componentRef.setInput('id', invoice.id);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/invoices/i1').flush(invoice);
    httpTesting.expectOne('/api/v1/customers/c1').flush(customer);
    // Loaded for the alerts of a draft, and answered here so that every test starts on a quiet page.
    httpTesting.match('/api/v1/customers/c1/credit').forEach(request => request.flush(credit));
    fixture.detectChanges();
    httpTesting.match(request => request.url.startsWith('/api/v1/agencies/g1/stock/'))
      .forEach(request => request.flush(stock));
    httpTesting.match('/api/v1/invoices/i1/payments').forEach(request => request.flush([]));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const buttons = () => [...element.querySelectorAll('aside .actions button')].map(b => b.textContent?.trim());

    const totals = () => element.querySelector('aside dl')?.textContent?.replace(/\s+/g, ' ') ?? '';

    return { component: fixture.componentInstance, element, refresh, buttons, totals, navigate };
  }

  afterEach(() => httpTesting.verify());

  it('loads the document and its customer', () => {
    const { component, element, buttons } = setup();

    expect(component.heading()).toBe('Facture FAC-COT-2026-00001');
    expect(component.customer()).toEqual(customer);
    expect(element.querySelector('app-invoice-line-form')).not.toBeNull();
    expect(buttons()).toEqual(['Valider', 'Supprimer le brouillon']);
  });

  it('shows the loading error when the document does not exist', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(InvoicePageComponent);
    fixture.componentRef.setInput('id', 'i404');
    fixture.detectChanges();

    httpTesting.expectOne('/api/v1/invoices/i404').flush(
      { status: 404, message: 'Document introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(fixture.componentInstance.error()).toBe('Document introuvable');
  });

  it('validates only after confirmation, then locks the document', () => {
    const { component, refresh, buttons, element } = setup();

    component.askValidation();
    httpTesting.expectNone('/api/v1/invoices/i1/validation');
    expect(component.validationMessage()).toContain('stock');

    component.validate();
    const req = httpTesting.expectOne('/api/v1/invoices/i1/validation');
    expect(req.request.method).toBe('POST');
    req.flush(validated);
    refresh();
    // Once validated, the invoice can be collected: its payments load.
    httpTesting.match('/api/v1/invoices/i1/payments').forEach(request => request.flush([]));
    refresh();

    expect(component.invoice()?.status).toBe('VALIDATED');
    expect(component.notice()).toBe('Document validé.');
    expect(element.querySelector('app-invoice-line-form')).toBeNull();
    expect(buttons()).toEqual(['Annuler le document']);
  });

  it('keeps the draft when the backend refuses the validation', () => {
    const { component } = setup();

    component.validate();
    httpTesting.expectOne('/api/v1/invoices/i1/validation').flush(
      { status: 400, message: 'Stock insuffisant pour « Ciment CIM II 32.5R »', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toContain('Stock insuffisant');
    expect(component.invoice()?.status).toBe('DRAFT');
    expect(component.validating()).toBe(false);
  });

  it('takes the new totals when a line changes', () => {
    const { component } = setup();
    const changed = { ...draft, totalAmount: 118000 };

    component.onInvoiceChanged(changed);

    expect(component.invoice()).toEqual(changed);
  });

  it('deletes a draft after confirmation and goes back to the list', () => {
    const { component, navigate } = setup();

    component.askDelete();
    httpTesting.expectNone('/api/v1/invoices/i1');
    expect(component.deleteMessage()).toContain('FAC-COT-2026-00001');

    component.deleteDraft();
    const req = httpTesting.expectOne('/api/v1/invoices/i1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(navigate).toHaveBeenCalledWith(['/invoices']);
  });

  it('no longer offers the cancellation once something was paid', () => {
    const { component } = setup({ ...validated, paidAmount: 10000 });

    expect(component.cancellable()).toBe(false);
  });

  it('shows the cancelled document handed back by the form', () => {
    const { component } = setup(validated);
    component.openCancel();

    component.onCancelled({ ...validated, status: 'CANCELLED', cancellationReason: 'Erreur de client' });

    expect(component.cancelOpen()).toBe(false);
    expect(component.invoice()?.status).toBe('CANCELLED');
    expect(component.cancellable()).toBe(false);
  });

  it('saves the line the form composed and takes the document back', () => {
    const { component, refresh } = setup();
    const withTwoLines = { ...draft, lines: [line, { ...line, id: 'l2' }], totalAmount: 118000 };

    component.addLine({
      articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
      unitLabel: 'Sac', appliedCoefficient: 50, quantity: 10, discountRate: 5, unitPrice: 5000, vatRate: 0.18,
    });

    const request = httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/invoices/i1/lines');
    // Only the three fields the backend accepts: it prices the line itself.
    expect(request.request.body).toEqual({ packagingId: 'k1', quantity: 10, discountRate: 5 });
    request.flush(withTwoLines);
    refresh();
    httpTesting.match(r => r.url.startsWith('/api/v1/agencies/g1/stock/')).forEach(r => r.flush(stock));

    expect(component.invoice()?.lines.length).toBe(2);
    expect(component.addingLine()).toBe(false);
  });

  it('shows the refusal of a line without losing the document', () => {
    const { component } = setup();

    component.addLine({
      articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
      unitLabel: 'Sac', appliedCoefficient: 50, quantity: 10, discountRate: 30, unitPrice: 5000, vatRate: 0.18,
    });

    httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/invoices/i1/lines').flush(
      { status: 400, message: 'Remise de 30 % refusée : votre plafond est de 5 %', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toContain('refusée');
    expect(component.addingLine()).toBe(false);
    expect(component.invoice()?.lines.length).toBe(1);
  });

  it('shows what has been collected once the invoice is validated', () => {
    expect(setup(validated).element.querySelector('app-invoice-payments')).not.toBeNull();
  });

  it('shows no payment section on a draft: there is nothing to collect yet', () => {
    expect(setup(draft).element.querySelector('app-invoice-payments')).toBeNull();
  });

  it('takes the new totals of the invoice from the payment that was just taken', () => {
    const { component } = setup(validated);

    component.onPaymentChanged({
      id: 'p1', invoiceId: 'i1', amount: 50000, invoicePaidAmount: 50000, invoiceRemainingToPay: 9000,
    } as Payment);

    expect(component.invoice()?.paidAmount).toBe(50000);
    expect(component.invoice()?.remainingToPay).toBe(9000);
    // Nothing else of the document moved: no reload was needed.
    expect(component.invoice()?.totalAmount).toBe(59000);
  });

  it('warns on a draft that the credit of the customer will refuse the validation', () => {
    const { element } = setup({ ...draft, creditMode: true, totalAmount: 59000 });

    expect(element.querySelector('app-invoice-alerts')?.textContent).toContain('Plafond de crédit');
  });

  it('leaves a validated document without any warning: it is too late for them', () => {
    const { element } = setup(validated);

    expect(element.querySelector('app-invoice-alerts')).toBeNull();
  });

  it('offers to type the transport charges of a draft that has none', () => {
    const { element } = setup();
    const row = element.querySelector('app-invoice-transport');

    expect(row?.textContent).toContain('Transport');
    expect(row?.querySelector('button')?.textContent?.trim()).toBe('Modifier');
  });

  it('shows the transport charges between the VAT and the total', () => {
    const { totals } = setup({ ...draft, transportAmount: 5000, totalAmount: 64000 });

    expect(totals()).toContain('Transport');
    expect(totals()).toContain('5 000');
  });

  it('lets a cashier read and print a draft, nothing more', () => {
    const { element, buttons } = setup(draft, 'CASHIER');

    expect(buttons()).toEqual([]);
    expect(element.querySelector('app-invoice-line-form')).toBeNull();
    expect(element.querySelector('aside .actions a')?.textContent?.trim()).toBe('Imprimer');
  });

  it('lets a seller fill a draft but not delete it', () => {
    expect(setup(draft, 'SELLER').buttons()).toEqual(['Valider']);
  });
});
