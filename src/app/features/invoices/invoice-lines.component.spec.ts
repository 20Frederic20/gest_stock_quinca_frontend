import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Invoice, InvoiceLine } from '../../core/models/invoice.model';
import { InvoiceLinesComponent } from './invoice-lines.component';

const line: InvoiceLine = {
  id: 'l1', articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1', unitLabel: 'Sac',
  quantity: 10, deliveredQuantity: 0, remainingToDeliver: 10, unitPrice: 5000, discountRate: 0, discountAmount: 0,
  vatRate: 0.18, netAmount: 50000, vatAmount: 9000, totalAmount: 59000,
};
const updated = { id: 'i1', lines: [{ ...line, quantity: 12 }] } as Invoice;

describe('InvoiceLinesComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(editable = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoiceLinesComponent);
    fixture.componentRef.setInput('invoiceId', 'i1');
    fixture.componentRef.setInput('lines', [line]);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const changed = vi.fn();
    const failed = vi.fn();
    component.changed.subscribe(changed);
    component.failed.subscribe(failed);

    return { component, element: fixture.nativeElement as HTMLElement, changed, failed };
  }

  afterEach(() => httpTesting.verify());

  it('shows each line with its VAT in percent', () => {
    const { element } = setup();
    const text = element.querySelector('tbody tr')?.textContent?.replace(/\s+/g, ' ');

    expect(text).toContain('CIM-32R Ciment CIM II 32.5R');
    expect(text).toContain('18 %');
  });

  it('offers no action on a locked document', () => {
    expect(setup(false).element.querySelectorAll('button').length).toBe(0);
  });

  it('saves a new quantity and discount, keeping the packaging of the line', () => {
    const { component, changed } = setup();
    component.edit(line);
    component.form.setValue({ quantity: 12, discountRate: 5 });

    component.save(line);

    const req = httpTesting.expectOne('/api/v1/invoices/i1/lines/l1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ packagingId: 'k1', quantity: 12, discountRate: 5 });
    req.flush(updated);
    expect(changed).toHaveBeenCalledWith(updated);
    expect(component.editingId()).toBeNull();
  });

  it('refuses invalid values without calling the backend', () => {
    const { component, failed } = setup();
    component.edit(line);
    component.form.setValue({ quantity: 0, discountRate: 120 });

    component.save(line);

    httpTesting.expectNone('/api/v1/invoices/i1/lines/l1');
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('removes a line', () => {
    const { component, changed } = setup();

    component.remove(line);

    const req = httpTesting.expectOne('/api/v1/invoices/i1/lines/l1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: 'i1', lines: [] });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('passes on the backend refusal, e.g. a discount above the seller’s limit', () => {
    const { component, failed } = setup();
    component.edit(line);
    component.form.setValue({ quantity: 10, discountRate: 30 });

    component.save(line);

    httpTesting.expectOne('/api/v1/invoices/i1/lines/l1').flush(
      { status: 400, message: 'Remise de 30 % refusée : votre plafond est de 5 %', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(failed).toHaveBeenCalledWith('Remise de 30 % refusée : votre plafond est de 5 %');
    expect(component.editingId()).toBe('l1');
  });
});
