import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Customer } from '../../core/models/customer.model';
import { Invoice } from '../../core/models/invoice.model';
import { InvoicePrintComponent } from './invoice-print.component';

const at = '2026-09-15T08:00:00';
const invoice = {
  id: 'i1', number: 'FAC-COT-2026-00001', type: 'INVOICE', status: 'VALIDATED', documentDate: '2026-09-15', dueDate: null,
  grossAmount: 50000, discountAmount: 0, netAmount: 50000, vatAmount: 9000, totalAmount: 59000, creditMode: false,
  cancellationReason: null, customerId: 'c1', agencyId: 'g1', userName: 'Awa Dossou', createdAt: at,
  lines: [{
    id: 'l1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', unitLabel: 'Sac', quantity: 10,
    unitPrice: 5000, discountRate: 0, netAmount: 50000,
  }],
} as unknown as Invoice;
const agency: Agency = {
  id: 'g1', code: 'COT', label: 'Cotonou — Siège', address: 'Rue 12, Akpakpa', phone: '+229 21 00 00 00',
  taxId: '3201800000001', active: true, createdAt: at, updatedAt: at,
};
const customer = { id: 'c1', code: 'CLI-001', name: 'Bâtiments Houngbo', address: null, phone: null, taxId: null } as Customer;

describe('InvoicePrintComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(document: Invoice = invoice) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoicePrintComponent);
    fixture.componentRef.setInput('id', 'i1');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const load = () => {
      httpTesting.expectOne('/api/invoices/i1').flush(document);
      httpTesting.expectOne('/api/v1/agencies/g1').flush(agency);
      httpTesting.expectOne('/api/customers/c1').flush(customer);
      fixture.detectChanges();
    };

    return { component: fixture.componentInstance, element, fixture, load };
  }

  afterEach(() => httpTesting.verify());

  it('lays out the seller, the customer, the lines and the totals', () => {
    const { element, load } = setup();
    load();
    const text = element.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(text).toContain('Cotonou — Siège');
    expect(text).toContain('IFU 3201800000001');
    expect(text).toContain('N° FAC-COT-2026-00001');
    expect(text).toContain('Bâtiments Houngbo');
    expect(text).toContain('CIM-32R — Ciment CIM II 32.5R');
    expect(element.querySelector('.banner')).toBeNull();
  });

  it('marks a draft so that it is not taken for a real invoice', () => {
    const { element, load } = setup({ ...invoice, status: 'DRAFT' });
    load();

    expect(element.querySelector('.banner')?.textContent).toContain('Brouillon');
  });

  it('prints through the browser', () => {
    const { component, load } = setup();
    load();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    component.print();

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('shows the error when the document cannot be loaded', () => {
    const { component } = setup();

    httpTesting.expectOne('/api/invoices/i1').flush(
      { status: 404, message: 'Document introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.error()).toBe('Document introuvable');
    expect(component.data()).toBeNull();
  });
});
