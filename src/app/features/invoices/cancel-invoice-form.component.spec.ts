import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Invoice } from '../../core/models/invoice.model';
import { CancelInvoiceFormComponent } from './cancel-invoice-form.component';

const URL = '/api/invoices/i1/cancellation';

describe('CancelInvoiceFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(CancelInvoiceFormComponent);
    fixture.componentRef.setInput('invoiceId', 'i1');
    fixture.componentRef.setInput('summary', 'Facture FAC-COT-2026-00001');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('recalls which document is being cancelled', () => {
    expect(setup().element.textContent).toContain('Facture FAC-COT-2026-00001');
  });

  it('requires a reason of at most 255 characters', () => {
    const { component } = setup();
    const { reason } = component.form.controls;

    expect(reason.hasError('required')).toBe(true);
    reason.setValue('   ');
    expect(reason.hasError('blank')).toBe(true);
    reason.setValue('A'.repeat(256));
    expect(reason.hasError('maxlength')).toBe(true);
  });

  it('does not call the backend while the form is invalid', () => {
    const { component, saved } = setup();

    component.submit();

    httpTesting.expectNone(URL);
    expect(saved).not.toHaveBeenCalled();
  });

  it('cancels with a trimmed reason and hands back the document', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('  Erreur de client ');

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.body).toEqual({ reason: 'Erreur de client' });
    const cancelled = { id: 'i1', status: 'CANCELLED' } as Invoice;
    req.flush(cancelled);
    expect(saved).toHaveBeenCalledWith(cancelled);
  });

  it('shows the backend refusal', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Erreur de client');

    component.submit();

    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Impossible d’annuler un document déjà réglé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toContain('déjà réglé');
    expect(saved).not.toHaveBeenCalled();
  });
});
