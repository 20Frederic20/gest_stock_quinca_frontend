import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { PurchaseOrderSummary } from '../../core/models/purchase-order.model';
import { ReceptionListComponent } from './reception-list.component';

const at = '2026-09-16T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});

const waiting = {
  id: 'o1', number: 'CDE-COT-2026-00001', status: 'CONFIRMED', orderDate: '2026-09-16',
  expectedDeliveryDate: '2026-10-01', totalAmount: 495600, supplierId: 'f1', supplierName: 'Ciments du Bénin',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', createdAt: at,
} as PurchaseOrderSummary;

describe('ReceptionListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
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
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'MANAGER', agencyId: 'g1',
      agencyLabel: 'Cotonou — Siège',
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(ReceptionListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou — Siège'), agency('g2', 'Parakou')]);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();

    return { component: fixture.componentInstance, element, refresh, navigate };
  }

  afterEach(() => httpTesting.verify());

  it('lists the orders the agency is still waiting for', () => {
    const { component, element, refresh } = setup();

    httpTesting.expectOne('/api/v1/agencies/g1/purchase-orders/pending').flush([waiting]);
    refresh();

    const text = element.querySelector('tbody')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('CDE-COT-2026-00001');
    expect(text).toContain('Ciments du Bénin');
    expect(component.orders()).toEqual([waiting]);
  });

  it('says so when nothing is awaited', () => {
    const { component, element, refresh } = setup();

    httpTesting.expectOne('/api/v1/agencies/g1/purchase-orders/pending').flush([]);
    refresh();

    expect(component.orders()).toEqual([]);
    expect(element.textContent).toContain('Aucune commande en attente');
  });

  it('opens the order to receive its goods', () => {
    const { component, navigate } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/purchase-orders/pending').flush([waiting]);

    component.open(waiting);

    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'o1']);
  });

  it('switches agency', () => {
    const { component } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/purchase-orders/pending').flush([waiting]);

    component.onAgencySelected({ id: 'g2', label: 'Parakou' });

    httpTesting.expectOne('/api/v1/agencies/g2/purchase-orders/pending').flush([]);
    expect(component.orders()).toEqual([]);
  });

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne('/api/v1/agencies/g1/purchase-orders/pending').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
