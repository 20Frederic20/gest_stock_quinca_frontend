import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { CustomerCredit } from '../../core/models/customer.model';
import { Invoice, InvoiceLine } from '../../core/models/invoice.model';
import { AgencyStock } from '../../core/models/stock.model';
import { InvoiceAlertsComponent } from './invoice-alerts.component';

const line = {
  id: 'l1', articleId: 'a1', designation: 'Ciment CIM II 32.5R', quantity: 3, appliedCoefficient: 50,
} as InvoiceLine;
const draft = {
  id: 'i1', type: 'INVOICE', status: 'DRAFT', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
  creditMode: false, totalAmount: 59000, lines: [line],
} as Invoice;
const credit = {
  customerId: 'c1', creditLimit: 200000, currentBalance: 150000, remainingCredit: 50000, creditAllowed: true,
} as CustomerCredit;
const stock = { articleId: 'a1', stockUnitCode: 'KG', availableQuantity: 100 } as AgencyStock;

describe('InvoiceAlertsComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(invoice: Invoice = draft, customerCredit: CustomerCredit | null = credit) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoiceAlertsComponent);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.componentRef.setInput('credit', customerCredit);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const text = () => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    return { component: fixture.componentInstance, fixture, element, refresh, text };
  }

  afterEach(() => httpTesting.verify());

  it('keeps quiet when the sale fits the credit and the stock', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush({ ...stock, availableQuantity: 500 });
    refresh();

    expect(text()).toBe('');
  });

  it('warns when a credit sale goes past what the customer may still owe', () => {
    const { text, refresh } = setup({ ...draft, creditMode: true, totalAmount: 59000 });
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush({ ...stock, availableQuantity: 500 });
    refresh();

    expect(text()).toContain('Plafond de crédit');
    expect(text()).toContain('9 000');
  });

  it('says nothing about the credit of a cash sale, whatever its amount', () => {
    const { text, refresh } = setup({ ...draft, creditMode: false, totalAmount: 900000 });
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush({ ...stock, availableQuantity: 500 });
    refresh();

    expect(text()).toBe('');
  });

  it('adds up the lines of one article and warns when the agency holds less', () => {
    const second = { ...line, id: 'l2', quantity: 2 } as InvoiceLine;
    const { text, refresh } = setup({ ...draft, lines: [line, second] });

    // One call for the article, not one per line, and on the agency of the document.
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush(stock);
    refresh();

    expect(text()).toContain('Ciment CIM II 32.5R');
    expect(text()).toContain('250');
    expect(text()).toContain('100');
  });

  it('treats an article that never moved in the agency as having nothing left', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush(
      { status: 404, message: 'Stock introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );
    refresh();

    expect(text()).toContain('Ciment CIM II 32.5R');
  });

  it('leaves the stock alone for a quote, which reserves nothing', () => {
    const { text } = setup({ ...draft, type: 'QUOTE' });

    httpTesting.expectNone('/api/v1/agencies/g1/stock/a1');
    expect(text()).toBe('');
  });

  it('checks the stock again when a line was added', () => {
    const { fixture, refresh, text } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush({ ...stock, availableQuantity: 500 });
    refresh();
    expect(text()).toBe('');

    fixture.componentRef.setInput('invoice', { ...draft, lines: [line, { ...line, id: 'l2', quantity: 10 }] });
    refresh();

    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush({ ...stock, availableQuantity: 500 });
    refresh();

    expect(text()).toContain('650');
  });
});
