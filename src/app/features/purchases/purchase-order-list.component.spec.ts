import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { PurchaseOrder, PurchaseOrderSummary } from '../../core/models/purchase-order.model';
import { Role } from '../../core/models/user.model';
import { PurchaseOrderListComponent } from './purchase-order-list.component';

const at = '2026-09-16T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});

const order = {
  id: 'o1', number: 'CDE-COT-2026-00001', status: 'CONFIRMED', orderDate: '2026-09-16',
  expectedDeliveryDate: '2026-10-01', totalAmount: 495600, supplierId: 'f1', supplierName: 'Ciments du Bénin',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', createdAt: at,
} as PurchaseOrderSummary;

const page = (content: PurchaseOrderSummary[]) => ({
  content, totalElements: content.length, totalPages: 1, number: 0, size: 20,
});

describe('PurchaseOrderListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(role: Role = 'MANAGER') {
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

    const fixture = TestBed.createComponent(PurchaseOrderListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou — Siège'), agency('g2', 'Parakou')]);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();

    return { component: fixture.componentInstance, element, refresh, navigate };
  }

  afterEach(() => httpTesting.verify());

  it('lists the orders of the user’s own agency', () => {
    const { component, element, refresh } = setup();

    const request = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/purchase-orders');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(page([order]));
    refresh();

    const text = element.querySelector('tbody')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('CDE-COT-2026-00001');
    expect(text).toContain('Ciments du Bénin');
    expect(text).toContain('Confirmée');
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 1, totalElements: 1 });
  });

  it('switches agency and starts again from the first page', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/purchase-orders').flush(page([order]));

    component.onAgencySelected({ id: 'g2', label: 'Parakou' });

    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g2/purchase-orders' && r.params.get('page') === '0')
      .flush(page([]));
    expect(component.orders()).toEqual([]);
  });

  it('opens an order', () => {
    const { component, navigate } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/purchase-orders').flush(page([order]));

    component.open(order);

    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'o1']);
  });

  it('creates an order then opens it straight away', () => {
    const { component, navigate } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/purchase-orders').flush(page([]));

    component.openCreate();
    expect(component.formOpen()).toBe(true);

    component.onCreated({ id: 'o9', number: 'CDE-COT-2026-00009' } as PurchaseOrder);

    expect(component.formOpen()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'o9']);
  });

  it('lets a seller read the orders without opening a new one', () => {
    const { component } = setup('SELLER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/purchase-orders').flush(page([order]));

    expect(component.canWrite()).toBe(false);
  });

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/purchase-orders').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
