import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Payment } from '../../core/models/payment.model';
import { CancelPaymentFormComponent } from './cancel-payment-form.component';

const URL = '/api/v1/payments/p1/cancellation';
const cancelled = { id: 'p1', cancelled: true, invoiceRemainingToPay: 59000 } as Payment;

describe('CancelPaymentFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(CancelPaymentFormComponent);
    fixture.componentRef.setInput('paymentId', 'p1');
    fixture.componentRef.setInput('summary', 'REG-COT-2026-00001 — 50 000 F CFA');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('recalls which payment is being cancelled', () => {
    expect(setup().element.textContent).toContain('REG-COT-2026-00001');
  });

  it('requires a reason of at most 255 characters', () => {
    const { component } = setup();
    const { reason } = component.form.controls;

    expect(reason.hasError('required')).toBe(true);
    reason.setValue('A'.repeat(256));
    expect(reason.hasError('maxlength')).toBe(true);
  });

  it('cancels the payment and hands back the invoice as it now stands', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Chèque sans provision');

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.body).toEqual({ reason: 'Chèque sans provision' });
    request.flush(cancelled);

    expect(saved).toHaveBeenCalledWith(cancelled);
  });

  it('shows the refusal of the backend', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Erreur de saisie');

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Ce règlement est déjà annulé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('déjà annulé');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
