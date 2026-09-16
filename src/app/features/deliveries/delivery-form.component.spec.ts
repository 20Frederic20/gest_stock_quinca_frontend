import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Delivery } from '../../core/models/delivery.model';
import { InvoiceLine } from '../../core/models/invoice.model';
import { DeliveryFormComponent } from './delivery-form.component';

const URL = '/api/v1/invoices/i1/deliveries';

const cement = {
  id: 'l1', articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', unitLabel: 'Sac',
  quantity: 10, deliveredQuantity: 4, remainingToDeliver: 6, appliedCoefficient: 50,
} as InvoiceLine;

const iron = {
  id: 'l2', articleId: 'a2', articleCode: 'FER-12', designation: 'Fer à béton 12 mm', unitLabel: 'Barre',
  quantity: 25, deliveredQuantity: 25, remainingToDeliver: 0, appliedCoefficient: 1,
} as InvoiceLine;

const note = { id: 'd1', number: 'BL-COT-2026-00001', invoiceDeliveryStatus: 'PARTIALLY_DELIVERED' } as Delivery;

describe('DeliveryFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(lines: InvoiceLine[] = [cement, iron]) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(DeliveryFormComponent);
    fixture.componentRef.setInput('invoiceId', 'i1');
    fixture.componentRef.setInput('invoiceNumber', 'FAC-COT-2026-00001');
    fixture.componentRef.setInput('lines', lines);
    fixture.detectChanges();

    const delivered = vi.fn();
    fixture.componentInstance.delivered.subscribe(delivered);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, delivered };
  }

  afterEach(() => httpTesting.verify());

  it('offers the lines that still owe something, filled with what is left', () => {
    const { component, element } = setup();

    expect(component.pending().map(line => line.id)).toEqual(['l1']);
    expect(component.quantities.getRawValue()).toEqual({ l1: 6 });
    // The line already handed over in full has nothing more to give.
    expect(element.textContent).toContain('Ciment CIM II 32.5R');
    expect(element.textContent).not.toContain('Fer à béton 12 mm');
  });

  it('refuses to hand over more than what is left on a line', () => {
    const { component, delivered } = setup();
    component.quantities.controls['l1'].setValue(7);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.quantities.controls['l1'].hasError('max')).toBe(true);
    expect(delivered).not.toHaveBeenCalled();
  });

  it('refuses an empty note without asking the backend', () => {
    const { component, delivered } = setup();
    component.quantities.controls['l1'].setValue(0);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.formError()).toContain('au moins une quantité');
    expect(delivered).not.toHaveBeenCalled();
  });

  it('sends only the lines actually handed over, with the comment', () => {
    const { component, delivered } = setup([cement, { ...cement, id: 'l3', designation: 'Sable' }]);
    component.quantities.controls['l1'].setValue(2);
    component.quantities.controls['l3'].setValue(0);
    component.form.controls.comment.setValue('  Livré au chantier  ');

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      comment: 'Livré au chantier',
      lines: [{ invoiceLineId: 'l1', quantity: 2 }],
    });
    request.flush(note);

    expect(delivered).toHaveBeenCalledWith(note);
    expect(component.saving()).toBe(false);
  });

  it('sends no comment when none was typed', () => {
    const { component } = setup();

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.body).toEqual({ comment: null, lines: [{ invoiceLineId: 'l1', quantity: 6 }] });
    request.flush(note);
  });

  it('shows the refusal of the backend and keeps what was typed', () => {
    const { component, delivered } = setup();

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Cette facture n’est pas validée : aucune livraison possible', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('aucune livraison possible');
    expect(component.saving()).toBe(false);
    expect(component.quantities.getRawValue()).toEqual({ l1: 6 });
    expect(delivered).not.toHaveBeenCalled();
  });
});
