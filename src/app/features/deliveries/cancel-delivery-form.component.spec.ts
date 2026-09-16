import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Delivery } from '../../core/models/delivery.model';
import { CancelDeliveryFormComponent } from './cancel-delivery-form.component';

const URL = '/api/v1/deliveries/d1/cancellation';
const cancelled = { id: 'd1', cancelled: true, invoiceDeliveryStatus: 'NOT_DELIVERED' } as Delivery;

describe('CancelDeliveryFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(CancelDeliveryFormComponent);
    fixture.componentRef.setInput('deliveryId', 'd1');
    fixture.componentRef.setInput('summary', 'BL-COT-2026-00001 du 16/09/2026');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('recalls which delivery note is being cancelled', () => {
    expect(setup().element.textContent).toContain('BL-COT-2026-00001');
  });

  it('requires a reason of at most 255 characters', () => {
    const { component } = setup();
    const { reason } = component.form.controls;

    expect(reason.hasError('required')).toBe(true);
    reason.setValue('A'.repeat(256));
    expect(reason.hasError('maxlength')).toBe(true);
  });

  it('cancels the note and hands back where the invoice then stands', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Marchandise retournée');

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.body).toEqual({ reason: 'Marchandise retournée' });
    request.flush(cancelled);

    expect(saved).toHaveBeenCalledWith(cancelled);
  });

  it('shows the refusal of the backend', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Erreur de saisie');

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Ce bon de livraison est déjà annulé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('déjà annulé');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
