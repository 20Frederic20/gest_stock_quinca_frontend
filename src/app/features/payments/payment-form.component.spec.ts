import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Payment } from '../../core/models/payment.model';
import { PaymentFormComponent } from './payment-form.component';

const URL = '/api/v1/invoices/i1/payments';
const STATUS = '/api/v1/agencies/g1/day-closings/cash-status';
const NO_DAY_MESSAGE = "Aucune journée de caisse n'est ouverte pour cette agence : confirmez son ouverture automatique.";
const FRESH = { open: true, dayClosingId: 'd1', openedAt: '2026-10-31T08:00:00', stale: false, suggestedOpeningCash: 0 };
const CLOSED = { open: false, dayClosingId: null, openedAt: null, stale: false, suggestedOpeningCash: 125000 };
const STALE = { open: true, dayClosingId: 'd1', openedAt: '2026-10-29T08:05:00.123456', stale: true, suggestedOpeningCash: 0 };
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
    fixture.componentRef.setInput('agencyId', 'g1');
    fixture.componentRef.setInput('invoiceNumber', 'FAC-COT-2026-00001');
    fixture.componentRef.setInput('remainingToPay', remaining);
    fixture.detectChanges();

    const taken = vi.fn();
    fixture.componentInstance.taken.subscribe(taken);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, taken, fixture };
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
    httpTesting.expectOne(STATUS).flush(FRESH);

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
    httpTesting.expectOne(STATUS).flush(FRESH);

    const request = httpTesting.expectOne(URL);
    expect(request.request.body).toEqual({ method: 'CASH', amount: 59000, externalReference: null });
    request.flush(saved);
  });

  it('shows the refusal of the backend and keeps what was typed', () => {
    const { component, taken } = setup();

    component.submit();
    httpTesting.expectOne(STATUS).flush(FRESH);
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Cette facture est déjà entièrement réglée', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('déjà entièrement réglée');
    expect(component.saving()).toBe(false);
    expect(taken).not.toHaveBeenCalled();
  });

  describe('cash day', () => {
    const fail = (message: string) => [{ status: 400, message, fieldErrors: null }, { status: 400, statusText: 'Bad Request' }] as const;

    it('posts at once on a fresh open day, without new fields', () => {
      const { component, element } = setup();

      component.submit();
      httpTesting.expectOne(STATUS).flush(FRESH);

      expect(element.querySelector('[role="alertdialog"]')).toBeNull();
      expect(httpTesting.expectOne(URL).request.body).toEqual({ method: 'CASH', amount: 59000, externalReference: null });
    });

    it('proposes the opening cash when no day is open, and posts the edited amount on confirm', () => {
      const { component, element, fixture } = setup();

      component.submit();
      httpTesting.expectOne(STATUS).flush(CLOSED);
      fixture.detectChanges();

      httpTesting.expectNone(URL);
      const dialog = element.querySelector('[role="alertdialog"]') as HTMLElement;
      expect(dialog.textContent).toContain("Aucune journée de caisse n'est ouverte.");
      expect(dialog.textContent).toContain('125');
      const input = dialog.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('125000');

      input.value = '90000';
      input.dispatchEvent(new Event('input'));
      (dialog.querySelector('.btn-primary') as HTMLButtonElement).click();

      const request = httpTesting.expectOne(URL);
      expect(request.request.body).toEqual({
        method: 'CASH',
        amount: 59000,
        externalReference: null,
        openDayIfClosed: true,
        openingCashAmount: 90000,
      });
      request.flush(saved);
    });

    it('sends nothing when the opening dialog is cancelled, and keeps the form', () => {
      const { component, element, fixture, taken } = setup();
      component.submit();
      httpTesting.expectOne(STATUS).flush(CLOSED);
      fixture.detectChanges();

      (element.querySelector('[role="alertdialog"] .icon-cancel') as HTMLButtonElement).click();
      fixture.detectChanges();

      httpTesting.expectNone(URL);
      expect(element.querySelector('[role="alertdialog"]')).toBeNull();
      expect(component.saving()).toBe(false);
      expect(component.form.controls.amount.value).toBe(59000);
      expect(taken).not.toHaveBeenCalled();
    });

    it('refuses a negative opening cash', () => {
      const { component, element, fixture } = setup();
      component.submit();
      httpTesting.expectOne(STATUS).flush(CLOSED);
      fixture.detectChanges();
      const dialog = element.querySelector('[role="alertdialog"]') as HTMLElement;
      const input = dialog.querySelector('input') as HTMLInputElement;
      input.value = '-5';
      input.dispatchEvent(new Event('input'));

      (dialog.querySelector('.btn-primary') as HTMLButtonElement).click();

      httpTesting.expectNone(URL);
    });

    it('asks to confirm a day open for more than 24 h, with its date, then posts confirmStaleDay', () => {
      const { component, element, fixture } = setup();
      component.submit();
      httpTesting.expectOne(STATUS).flush(STALE);
      fixture.detectChanges();

      httpTesting.expectNone(URL);
      const dialog = element.querySelector('[role="alertdialog"]') as HTMLElement;
      expect(dialog.textContent).toContain('ouverte depuis le 29/10/2026 à 08:05 (plus de 24 h)');
      expect(dialog.querySelector('input')).toBeNull();

      (dialog.querySelector('.btn-primary') as HTMLButtonElement).click();

      const request = httpTesting.expectOne(URL);
      expect(request.request.body).toEqual({ method: 'CASH', amount: 59000, externalReference: null, confirmStaleDay: true });
      request.flush(saved);
    });

    it('sends nothing when the stale-day dialog is cancelled', () => {
      const { component, element, fixture } = setup();
      component.submit();
      httpTesting.expectOne(STATUS).flush(STALE);
      fixture.detectChanges();

      (element.querySelector('[role="alertdialog"] .icon-cancel') as HTMLButtonElement).click();

      httpTesting.expectNone(URL);
    });

    it('shows the error and sends nothing when the cash status cannot be read', () => {
      const { component, taken } = setup();

      component.submit();
      httpTesting.expectOne(STATUS).flush(...fail('Accès refusé à cette agence'));

      httpTesting.expectNone(URL);
      expect(component.formError()).toContain('Accès refusé');
      expect(component.saving()).toBe(false);
      expect(taken).not.toHaveBeenCalled();
    });

    it('re-runs the flow once when the backend finds the day closed meanwhile', () => {
      const { component, element, fixture } = setup();

      component.submit();
      httpTesting.expectOne(STATUS).flush(FRESH);
      httpTesting.expectOne(URL).flush(...fail(NO_DAY_MESSAGE));

      // Re-fetched, and the right dialog is now shown instead of the raw error.
      httpTesting.expectOne(STATUS).flush(CLOSED);
      fixture.detectChanges();
      expect(component.formError()).toBeNull();
      expect(element.querySelector('[role="alertdialog"]')).not.toBeNull();
    });

    it('does not loop: a second identical refusal is shown as an error', () => {
      const { component, element, fixture } = setup();

      component.submit();
      httpTesting.expectOne(STATUS).flush(FRESH);
      httpTesting.expectOne(URL).flush(...fail(NO_DAY_MESSAGE));
      httpTesting.expectOne(STATUS).flush(FRESH);
      httpTesting.expectOne(URL).flush(...fail(NO_DAY_MESSAGE));

      httpTesting.expectNone(STATUS);
      fixture.detectChanges();
      expect(component.formError()).toContain('Aucune journée');
      expect(element.querySelector('[role="alertdialog"]')).toBeNull();
    });
  });
});
