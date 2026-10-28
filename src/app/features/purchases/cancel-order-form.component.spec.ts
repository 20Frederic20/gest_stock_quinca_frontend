import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PurchaseOrder } from '../../core/models/purchase-order.model';
import { CancelOrderFormComponent } from './cancel-order-form.component';

const URL = '/api/v1/purchase-orders/o1/cancellation';
const cancelled = { id: 'o1', status: 'CANCELLED', cancellationReason: 'Fournisseur en rupture' } as PurchaseOrder;

describe('CancelOrderFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(CancelOrderFormComponent);
    fixture.componentRef.setInput('orderId', 'o1');
    fixture.componentRef.setInput('summary', 'CDE-COT-2026-00001 du 16/09/2026');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('recalls which order is being cancelled', () => {
    expect(setup().element.textContent).toContain('CDE-COT-2026-00001');
  });

  it('requires a reason of at most 255 characters', () => {
    const { component } = setup();
    const { reason } = component.form.controls;

    expect(reason.hasError('required')).toBe(true);
    reason.setValue('A'.repeat(256));
    expect(reason.hasError('maxlength')).toBe(true);
  });

  it('cancels the order and hands it back', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Fournisseur en rupture');

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.body).toEqual({ reason: 'Fournisseur en rupture' });
    request.flush(cancelled);

    expect(saved).toHaveBeenCalledWith(cancelled);
  });

  it('shows the refusal of the backend', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Erreur de saisie');

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Impossible d’annuler une commande partiellement réceptionnée', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('partiellement réceptionnée');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
