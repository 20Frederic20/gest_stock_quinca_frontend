import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Delivery } from '../../core/models/delivery.model';
import { Invoice } from '../../core/models/invoice.model';
import { InvoiceDeliveriesComponent } from './invoice-deliveries.component';

const URL = '/api/v1/invoices/i1/deliveries';

const invoice = {
  id: 'i1', number: 'FAC-COT-2026-00001', type: 'INVOICE', status: 'VALIDATED',
  deliveryStatus: 'PARTIALLY_DELIVERED',
  lines: [{ id: 'l1', designation: 'Ciment CIM II 32.5R', unitLabel: 'Sac', quantity: 10, deliveredQuantity: 4, remainingToDeliver: 6 }],
} as Invoice;

const note = {
  id: 'd1', number: 'BL-COT-2026-00001', deliveryDate: '2026-09-16', comment: 'Livré au chantier',
  cancelled: false, cancellationReason: null, invoiceId: 'i1', invoiceDeliveryStatus: 'PARTIALLY_DELIVERED',
  createdByName: 'Awa Dossou',
  lines: [{ id: 'dl1', invoiceLineId: 'l1', designation: 'Ciment CIM II 32.5R', unitLabel: 'Sac', quantity: 4, invoicedQuantity: 10, deliveredQuantity: 4, remainingToDeliver: 6 }],
} as Delivery;

describe('InvoiceDeliveriesComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(document: Invoice = invoice, canDeliver = true, canCancel = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoiceDeliveriesComponent);
    fixture.componentRef.setInput('invoice', document);
    fixture.componentRef.setInput('canDeliver', canDeliver);
    fixture.componentRef.setInput('canCancelDelivery', canCancel);
    fixture.detectChanges();

    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const text = () => element.textContent?.replace(/\s+/g, ' ') ?? '';

    return { component: fixture.componentInstance, element, refresh, text, changed };
  }

  afterEach(() => httpTesting.verify());

  it('lists the notes with what left the shop on each', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(URL).flush([note]);
    refresh();

    expect(text()).toContain('BL-COT-2026-00001');
    expect(text()).toContain('Ciment CIM II 32.5R');
    expect(text()).toContain('Livré au chantier');
    expect(text()).toContain('Awa Dossou');
  });

  it('says so when nothing has left the shop yet', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(URL).flush([]);
    refresh();

    expect(text()).toContain('Aucune livraison');
  });

  it('offers to hand goods over while the invoice still owes some', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush([note]);

    expect(component.deliverable()).toBe(true);
  });

  it('offers nothing once everything has been handed over', () => {
    const { component } = setup({ ...invoice, deliveryStatus: 'FULLY_DELIVERED' });
    httpTesting.expectOne(URL).flush([note]);

    expect(component.deliverable()).toBe(false);
  });

  it('offers nothing to someone who may not hand goods over', () => {
    const { component } = setup(invoice, false);
    httpTesting.expectOne(URL).flush([note]);

    expect(component.deliverable()).toBe(false);
  });

  it('puts a new note at the top of the list and hands it to the page', () => {
    const { component, changed, refresh, text } = setup();
    httpTesting.expectOne(URL).flush([note]);
    component.openForm();
    refresh();

    const second = { ...note, id: 'd2', number: 'BL-COT-2026-00002' } as Delivery;
    component.onDelivered(second);
    refresh();

    expect(component.deliveries()[0]).toEqual(second);
    expect(component.formOpen()).toBe(false);
    expect(changed).toHaveBeenCalledWith(second);
    expect(text()).toContain('BL-COT-2026-00002');
  });

  it('marks a cancelled note and hands it to the page', () => {
    const { component, changed, refresh, text } = setup();
    httpTesting.expectOne(URL).flush([note]);
    component.openCancel(note);
    refresh();

    const undone = { ...note, cancelled: true, cancellationReason: 'Marchandise retournée' };
    component.onCancelled(undone);
    refresh();

    expect(component.deliveries()).toEqual([undone]);
    expect(component.cancelling()).toBeNull();
    expect(changed).toHaveBeenCalledWith(undone);
    expect(text()).toContain('Marchandise retournée');
  });

  it('shows the loading failure without hiding the rest of the document', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
    expect(component.deliveries()).toEqual([]);
  });
});
