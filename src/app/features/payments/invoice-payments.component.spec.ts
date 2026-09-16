import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Invoice } from '../../core/models/invoice.model';
import { Payment } from '../../core/models/payment.model';
import { InvoicePaymentsComponent } from './invoice-payments.component';

const URL = '/api/v1/invoices/i1/payments';

const invoice = {
  id: 'i1', number: 'FAC-COT-2026-00001', type: 'INVOICE', status: 'VALIDATED',
  totalAmount: 59000, paidAmount: 50000, remainingToPay: 9000,
} as Invoice;

const cheque = {
  id: 'p1', number: 'REG-COT-2026-00001', method: 'CHECK', amount: 50000, externalReference: '4412887',
  paymentDate: '2026-09-16', cancelled: false, cancellationReason: null, userName: 'Awa Dossou',
  invoiceId: 'i1', invoiceRemainingToPay: 9000, invoicePaidAmount: 50000,
} as Payment;

describe('InvoicePaymentsComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(document: Invoice = invoice, canPay = true, canCancel = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoicePaymentsComponent);
    fixture.componentRef.setInput('invoice', document);
    fixture.componentRef.setInput('canPay', canPay);
    fixture.componentRef.setInput('canCancelPayment', canCancel);
    fixture.detectChanges();

    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const text = () => element.textContent?.replace(/\s+/g, ' ') ?? '';

    return { component: fixture.componentInstance, element, refresh, text, changed };
  }

  afterEach(() => httpTesting.verify());

  it('lists what has already been collected on the invoice', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(URL).flush([cheque]);
    refresh();

    expect(text()).toContain('REG-COT-2026-00001');
    expect(text()).toContain('Chèque');
    expect(text()).toContain('4412887');
    expect(text()).toContain('50 000');
  });

  it('says so when nothing has been collected yet', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(URL).flush([]);
    refresh();

    expect(text()).toContain('Aucun règlement');
  });

  it('offers to collect what is left on a validated invoice', () => {
    const { component, refresh } = setup();
    httpTesting.expectOne(URL).flush([cheque]);
    refresh();

    expect(component.payable()).toBe(true);
  });

  it('offers nothing once the invoice is fully paid', () => {
    const { component } = setup({ ...invoice, paidAmount: 59000, remainingToPay: 0 });
    httpTesting.expectOne(URL).flush([cheque]);

    expect(component.payable()).toBe(false);
  });

  it('offers nothing to someone who may not take payments', () => {
    const { component } = setup(invoice, false);
    httpTesting.expectOne(URL).flush([cheque]);

    expect(component.payable()).toBe(false);
  });

  it('puts a new payment at the top of the list and hands it to the page', () => {
    const { component, changed, refresh, text } = setup();
    httpTesting.expectOne(URL).flush([cheque]);
    component.openForm();
    refresh();

    const cash = { ...cheque, id: 'p2', number: 'REG-COT-2026-00002', method: 'CASH', amount: 9000 } as Payment;
    component.onTaken(cash);
    refresh();

    expect(component.payments()[0]).toEqual(cash);
    expect(component.formOpen()).toBe(false);
    expect(changed).toHaveBeenCalledWith(cash);
    expect(text()).toContain('REG-COT-2026-00002');
  });

  it('marks a cancelled payment on the list and hands the invoice back to the page', () => {
    const { component, changed, refresh, text } = setup();
    httpTesting.expectOne(URL).flush([cheque]);
    component.openCancel(cheque);
    refresh();

    const undone = { ...cheque, cancelled: true, cancellationReason: 'Chèque sans provision' };
    component.onCancelled(undone);
    refresh();

    expect(component.payments()).toEqual([undone]);
    expect(component.cancelling()).toBeNull();
    expect(changed).toHaveBeenCalledWith(undone);
    expect(text()).toContain('Chèque sans provision');
  });

  it('shows the loading failure without hiding the rest of the document', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
    expect(component.payments()).toEqual([]);
  });
});
