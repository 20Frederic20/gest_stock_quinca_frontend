import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PurchaseOrder } from '../../core/models/purchase-order.model';
import { Reception, ReceptionSummary } from '../../core/models/reception.model';
import { OrderReceptionsComponent } from './order-receptions.component';

const URL = '/api/v1/purchase-orders/o1/receptions';

const order = {
  id: 'o1', number: 'CDE-COT-2026-00001', status: 'CONFIRMED',
  lines: [{ id: 'l1', designation: 'Ciment CIM II 32.5R', quantity: 100, receivedQuantity: 40, remainingToReceive: 60 }],
} as PurchaseOrder;

const confirmed = {
  id: 'r1', number: 'REC-COT-2026-00001', status: 'CONFIRMED', receptionDate: '2026-09-16',
  purchaseOrderId: 'o1', purchaseOrderNumber: 'CDE-COT-2026-00001', userName: 'Awa Dossou',
  hasSupplierInvoice: true, hasSignedReceipt: false,
} as ReceptionSummary;

const draft = { ...confirmed, id: 'r2', number: 'REC-COT-2026-00002', status: 'DRAFT' } as ReceptionSummary;

const page = (content: ReceptionSummary[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });

describe('OrderReceptionsComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(document: PurchaseOrder = order, canWrite = true) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(OrderReceptionsComponent);
    fixture.componentRef.setInput('order', document);
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.detectChanges();

    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const text = () => element.textContent?.replace(/\s+/g, ' ') ?? '';

    return { component: fixture.componentInstance, element, refresh, text, changed };
  }

  afterEach(() => httpTesting.verify());

  it('lists what has already arrived against the order', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([confirmed]));
    refresh();

    expect(text()).toContain('REC-COT-2026-00001');
    expect(text()).toContain('Confirmée');
    expect(text()).toContain('Awa Dossou');
  });

  it('says so when nothing has arrived yet', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([]));
    refresh();

    expect(text()).toContain('Aucune réception');
  });

  it('offers to receive goods on an order that waits for them', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([]));

    expect(component.receivable()).toBe(true);
  });

  it('offers nothing on an order still in draft', () => {
    const { component } = setup({ ...order, status: 'DRAFT' });
    httpTesting.expectOne(r => r.url === URL).flush(page([]));

    expect(component.receivable()).toBe(false);
  });

  it('offers nothing to someone who may not buy', () => {
    const { component } = setup(order, false);
    httpTesting.expectOne(r => r.url === URL).flush(page([]));

    expect(component.receivable()).toBe(false);
  });

  it('confirms a reception left in draft, then tells the page the order moved', () => {
    const { component, changed } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([draft]));

    component.confirm(draft);

    const request = httpTesting.expectOne('/api/v1/receptions/r2/confirmation');
    expect(request.request.method).toBe('POST');
    request.flush({ ...draft, status: 'CONFIRMED' } as Reception);

    // Reloaded: the reception list and the order both changed.
    httpTesting.expectOne(r => r.url === URL).flush(page([{ ...draft, status: 'CONFIRMED' }]));
    expect(changed).toHaveBeenCalled();
  });

  it('deletes a reception left in draft', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([draft]));

    component.askDelete(draft);
    httpTesting.expectNone('/api/v1/receptions/r2');

    component.confirmDelete();
    const request = httpTesting.expectOne('/api/v1/receptions/r2');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    httpTesting.expectOne(r => r.url === URL).flush(page([]));
    expect(component.receptions()).toEqual([]);
  });

  it('takes a reception in and reloads', () => {
    const { component, changed } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([]));
    component.openForm();

    component.onReceived({ id: 'r3', number: 'REC-COT-2026-00003' } as Reception);

    expect(component.formOpen()).toBe(false);
    httpTesting.expectOne(r => r.url === URL).flush(page([confirmed]));
    expect(changed).toHaveBeenCalled();
  });

  it('shows the loading failure without hiding the rest of the order', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
    expect(component.receptions()).toEqual([]);
  });

  it('offers to download the attached supplier invoice', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([confirmed]));
    refresh();

    expect(text()).toContain('Facture');
  });

  it('offers to attach the signed receipt once confirmed, when none is attached yet', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([confirmed]));
    refresh();

    expect(text()).toContain('Joindre bon signé');
  });

  it('uploads the signed receipt selected for a given reception, then reloads', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === URL).flush(page([confirmed]));

    component.askSignedReceipt(confirmed);
    const file = new File(['scan'], 'bon-signe.pdf', { type: 'application/pdf' });
    const input = { files: [file], value: 'bon-signe.pdf' } as unknown as HTMLInputElement;
    component.onSignedReceiptSelected({ target: input } as unknown as Event);

    const request = httpTesting.expectOne('/api/v1/receptions/r1/signed-receipt');
    expect(request.request.method).toBe('POST');
    request.flush({ ...confirmed, hasSignedReceipt: true } as unknown as Reception);

    httpTesting.expectOne(r => r.url === URL).flush(page([{ ...confirmed, hasSignedReceipt: true }]));
    expect(component.uploadingSignedReceipt()).toBeNull();
  });
});
