import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PurchaseOrder } from '../../core/models/purchase-order.model';
import { Role } from '../../core/models/user.model';
import { formatMoney } from '../pricing/price-rules';
import { PurchaseOrderPageComponent } from './purchase-order-page.component';

const at = '2026-09-16T08:00:00';
const line = {
  id: 'l1', articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
  unitLabel: 'Sac', quantity: 100, receivedQuantity: 0, remainingToReceive: 100, unitPrice: 4200,
  vatRate: 0.18, netAmount: 420000, vatAmount: 75600, totalAmount: 495600,
};
const draft = {
  id: 'o1', number: 'CDE-COT-2026-00001', status: 'DRAFT', orderDate: '2026-09-16',
  expectedDeliveryDate: '2026-10-01', netAmount: 420000, vatAmount: 75600, totalAmount: 495600,
  comment: null, cancellationReason: null, supplierId: 'f1', supplierName: 'Ciments du Bénin',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', userId: 'u1', userName: 'Awa Dossou',
  lines: [line], createdAt: at,
} as unknown as PurchaseOrder;
const confirmed = { ...draft, status: 'CONFIRMED' } as PurchaseOrder;

const receptionPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 };

describe('PurchaseOrderPageComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(order: PurchaseOrder = draft, role: Role = 'MANAGER') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role, agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(PurchaseOrderPageComponent);
    fixture.componentRef.setInput('id', 'o1');
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/purchase-orders/o1').flush(order);
    fixture.detectChanges();
    httpTesting.match(r => r.url === '/api/v1/purchase-orders/o1/receptions').forEach(r => r.flush(receptionPage));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const buttons = () => [...element.querySelectorAll('aside .actions button')].map(b => b.textContent?.trim());

    return { component: fixture.componentInstance, element, refresh, buttons, navigate };
  }

  afterEach(() => httpTesting.verify());

  it('loads the order and lets a draft be filled', () => {
    const { component, element, buttons } = setup();

    expect(component.heading()).toBe('Commande CDE-COT-2026-00001');
    expect(element.querySelector('app-purchase-order-line-form')).not.toBeNull();
    expect(buttons()).toEqual(['Confirmer', 'Supprimer le brouillon']);
  });

  it('shows no reception section while the order is a draft', () => {
    expect(setup().element.querySelector('app-order-receptions')).toBeNull();
  });

  it('shows the receptions once the order is confirmed, and offers to cancel it', () => {
    const { element, buttons } = setup(confirmed);

    expect(element.querySelector('app-order-receptions')).not.toBeNull();
    expect(element.querySelector('app-purchase-order-line-form')).toBeNull();
    expect(buttons()).toEqual(['Annuler la commande']);
  });

  it('offers no cancellation once part of the goods has arrived', () => {
    const { buttons } = setup({
      ...confirmed, status: 'PARTIALLY_RECEIVED',
      lines: [{ ...line, receivedQuantity: 40, remainingToReceive: 60 }],
    } as unknown as PurchaseOrder);

    expect(buttons()).toEqual([]);
  });

  it('saves the line the form composed and takes the order back', () => {
    const { component } = setup();

    component.addLine({ packagingId: 'k2', quantity: 10, unitPrice: 500 });

    const request = httpTesting.expectOne(r => r.method === 'POST' && r.url === '/api/v1/purchase-orders/o1/lines');
    expect(request.request.body).toEqual({ packagingId: 'k2', quantity: 10, unitPrice: 500 });
    request.flush({ ...draft, lines: [line, line] } as PurchaseOrder);

    expect(component.order()?.lines.length).toBe(2);
    expect(component.addingLine()).toBe(false);
  });

  it('confirms only after confirmation, then locks the order', () => {
    const { component, refresh } = setup();

    component.askConfirmation();
    httpTesting.expectNone('/api/v1/purchase-orders/o1/confirmation');
    expect(component.confirmMessage()).toContain(formatMoney(495600));

    component.confirmOrder();
    httpTesting.expectOne('/api/v1/purchase-orders/o1/confirmation').flush(confirmed);
    refresh();
    httpTesting.match(r => r.url === '/api/v1/purchase-orders/o1/receptions').forEach(r => r.flush(receptionPage));

    expect(component.order()?.status).toBe('CONFIRMED');
    expect(component.notice()).toContain('confirmée');
  });

  it('keeps the draft when the backend refuses the confirmation', () => {
    const { component } = setup();

    component.confirmOrder();
    httpTesting.expectOne('/api/v1/purchase-orders/o1/confirmation').flush(
      { status: 400, message: 'Impossible de confirmer une commande sans aucune ligne', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toContain('sans aucune ligne');
    expect(component.order()?.status).toBe('DRAFT');
  });

  it('deletes a draft after confirmation and goes back to the list', () => {
    const { component, navigate } = setup();

    component.askDelete();
    httpTesting.expectNone(r => r.method === 'DELETE');

    component.deleteDraft();
    httpTesting.expectOne(r => r.method === 'DELETE' && r.url === '/api/v1/purchase-orders/o1').flush(null);

    expect(navigate).toHaveBeenCalledWith(['/purchase-orders']);
  });

  it('loads the order again when a reception moved it', () => {
    const { component } = setup(confirmed);

    component.onReceptionChanged();

    httpTesting.expectOne('/api/v1/purchase-orders/o1').flush({ ...confirmed, status: 'PARTIALLY_RECEIVED' });
    httpTesting.match(r => r.url === '/api/v1/purchase-orders/o1/receptions').forEach(r => r.flush(receptionPage));
    expect(component.order()?.status).toBe('PARTIALLY_RECEIVED');
  });

  it('lets a seller read an order without touching it', () => {
    const { element, buttons } = setup(draft, 'SELLER');

    expect(buttons()).toEqual([]);
    expect(element.querySelector('app-purchase-order-line-form')).toBeNull();
  });

  it('shows the loading error when the order does not exist', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PurchaseOrderPageComponent);
    fixture.componentRef.setInput('id', 'o404');
    fixture.detectChanges();

    httpTesting.expectOne('/api/v1/purchase-orders/o404').flush(
      { status: 404, message: 'Commande introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(fixture.componentInstance.error()).toBe('Commande introuvable');
  });
});
