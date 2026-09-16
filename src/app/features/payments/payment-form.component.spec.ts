import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Payment } from '../../core/models/payment.model';
import { PaymentFormComponent } from './payment-form.component';

const URL = '/api/v1/invoices/i1/payments';
const saved = { id: 'p1', number: 'REG-COT-2026-00001', invoiceRemainingToPay: 9000 } as Payment;

describe('PaymentFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(remaining = 59000) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PaymentFormComponent);
    fixture.componentRef.setInput('invoiceId', 'i1');
    fixture.componentRef.setInput('invoiceNumber', 'FAC-COT-2026-00001');
    fixture.componentRef.setInput('remainingToPay', remaining);
    fixture.detectChanges();

    const taken = vi.fn();
    fixture.componentInstance.taken.subscribe(taken);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, taken };
  }

  afterEach(() => httpTesting.verify());

  it('recalls the invoice and offers to collect all that is left', () => {
    const { component, element } = setup();

    expect(element.textContent).toContain('FAC-COT-2026-00001');
    expect(component.form.getRawValue()).toEqual({ method: 'CASH', amount: 59000, externalReference: '' });
  });

  it('asks for no document when the customer pays cash', () => {
    const { component } = setup();

    expect(component.form.controls.externalReference.hasError('required')).toBe(false);
    expect(component.form.valid).toBe(true);
  });

  it('requires a reference as soon as the payment is not in cash', () => {
    const { component } = setup();

    component.onMethodSelected({ id: 'CHECK', label: 'Chèque' });

    expect(component.referenceLabel()).toBe('Numéro du chèque');
    expect(component.form.controls.externalReference.hasError('required')).toBe(true);

    component.form.controls.externalReference.setValue('4412887');
    expect(component.form.valid).toBe(true);
  });

  it('refuses an amount above what is left to pay, without asking the backend', () => {
    const { component, taken } = setup();
    component.form.controls.amount.setValue(59001);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.amount.hasError('max')).toBe(true);
    expect(taken).not.toHaveBeenCalled();
  });

  it('takes the payment and hands it back with the invoice as it now stands', () => {
    const { component, taken } = setup();
    component.onMethodSelected({ id: 'CHECK', label: 'Chèque' });
    component.form.patchValue({ amount: 50000, externalReference: ' 4412887 ' });

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.method).toBe('POST');
    // Trimmed, like the backend does before storing it.
    expect(request.request.body).toEqual({ method: 'CHECK', amount: 50000, externalReference: '4412887' });
    request.flush(saved);

    expect(taken).toHaveBeenCalledWith(saved);
    expect(component.saving()).toBe(false);
  });

  it('sends no reference at all when the payment is in cash', () => {
    const { component } = setup();
    component.form.controls.amount.setValue(59000);

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.body).toEqual({ method: 'CASH', amount: 59000, externalReference: null });
    request.flush(saved);
  });

  it('shows the refusal of the backend and keeps what was typed', () => {
    const { component, taken } = setup();

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Cette facture est déjà entièrement réglée', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('déjà entièrement réglée');
    expect(component.saving()).toBe(false);
    expect(taken).not.toHaveBeenCalled();
  });
});
