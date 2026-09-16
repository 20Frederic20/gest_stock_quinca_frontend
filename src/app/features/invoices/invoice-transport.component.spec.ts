import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Invoice } from '../../core/models/invoice.model';
import { InvoiceTransportComponent } from './invoice-transport.component';

const saved = { id: 'i1', transportAmount: 5000, totalAmount: 64000 } as Invoice;

describe('InvoiceTransportComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(amount = 0, editable = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoiceTransportComponent);
    fixture.componentRef.setInput('invoiceId', 'i1');
    fixture.componentRef.setInput('amount', amount);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const changed = vi.fn();
    const failed = vi.fn();
    component.changed.subscribe(changed);
    component.failed.subscribe(failed);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const text = () => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    return { component, element, refresh, text, changed, failed };
  }

  afterEach(() => httpTesting.verify());

  it('stays out of the totals of a locked document without transport charges', () => {
    expect(setup(0, false).element.querySelector('dt')).toBeNull();
  });

  it('shows the amount of a locked document, with no way to change it', () => {
    const { text, element } = setup(5000, false);

    expect(text()).toContain('Transport');
    expect(text()).toContain('5 000');
    expect(element.querySelector('button')).toBeNull();
  });

  it('offers to fill the charges of a draft that has none', () => {
    const { text, element } = setup(0);

    expect(text()).toContain('Transport');
    expect(element.querySelector('button')?.textContent?.trim()).toBe('Modifier');
  });

  it('saves the typed amount and hands back the document with its new totals', () => {
    const { component, changed, refresh, element } = setup(0);
    component.edit();
    refresh();
    component.field.setValue(5000);

    component.save();

    const req = httpTesting.expectOne('/api/v1/invoices/i1/transport');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ transportAmount: 5000 });
    req.flush(saved);
    refresh();

    expect(changed).toHaveBeenCalledWith(saved);
    expect(component.editing()).toBe(false);
    expect(element.querySelector('input')).toBeNull();
  });

  it('reports a refusal and keeps the amount being typed', () => {
    const { component, failed } = setup(0);
    component.edit();
    component.field.setValue(5000);

    component.save();
    httpTesting.expectOne('/api/v1/invoices/i1/transport').flush(
      { status: 400, message: 'Ce document est validé : il n’est plus modifiable', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(failed).toHaveBeenCalledWith('Ce document est validé : il n’est plus modifiable');
    expect(component.editing()).toBe(true);
    expect(component.saving()).toBe(false);
  });

  it('refuses to send a negative amount', () => {
    const { component } = setup(0);
    component.edit();
    component.field.setValue(-1);

    component.save();

    httpTesting.expectNone('/api/v1/invoices/i1/transport');
  });
});
