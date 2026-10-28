import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Delivery } from '../../core/models/delivery.model';
import { Role } from '../../core/models/user.model';
import { DeliveryListComponent } from './delivery-list.component';

const at = '2026-09-16T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});

const note = {
  id: 'd1', number: 'BL-COT-2026-00001', deliveryDate: '2026-09-16', comment: 'Livré au chantier',
  cancelled: false, cancellationReason: null, invoiceId: 'i1', invoiceNumber: 'FAC-COT-2026-00001',
  invoiceDeliveryStatus: 'PARTIALLY_DELIVERED', customerName: 'Bâtiments Houngbo', createdByName: 'Awa Dossou',
  lines: [{ id: 'dl1', invoiceLineId: 'l1', designation: 'Ciment CIM II 32.5R', unitLabel: 'Sac', quantity: 4 }],
} as Delivery;

const page = (content: Delivery[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });

describe('DeliveryListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(role: Role = 'SELLER') {
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

    const fixture = TestBed.createComponent(DeliveryListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou — Siège'), agency('g2', 'Parakou')]);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const rowActions = (row = 0) =>
      [...element.querySelectorAll('tbody tr')[row].querySelectorAll('.row-actions button')]
        .map(button => button.textContent?.trim());

    return { component: fixture.componentInstance, element, refresh, rowActions, navigate };
  }

  afterEach(() => httpTesting.verify());

  it('lists the notes of the user’s own agency, with their invoice and their articles', () => {
    const { component, element, refresh } = setup();

    const request = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/deliveries');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(page([note]));
    refresh();

    const text = element.querySelector('tbody')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('BL-COT-2026-00001');
    expect(text).toContain('FAC-COT-2026-00001');
    expect(text).toContain('Bâtiments Houngbo');
    expect(text).toContain('Ciment CIM II 32.5R');
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 1, totalElements: 1 });
  });

  it('opens the invoice behind a note', () => {
    const { component, navigate } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/deliveries').flush(page([note]));

    component.openInvoice(note);

    expect(navigate).toHaveBeenCalledWith(['/invoices', 'i1']);
  });

  it('offers the cancellation to a manager only', () => {
    const { rowActions, refresh } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/deliveries').flush(page([note]));
    refresh();

    expect(rowActions()).toEqual(['Annuler']);
  });

  it('offers nothing on the row to a seller', () => {
    const { rowActions, refresh } = setup('SELLER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/deliveries').flush(page([note]));
    refresh();

    expect(rowActions()).toEqual([]);
  });

  it('marks the cancelled note on its row', () => {
    const { component, element, refresh } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/deliveries').flush(page([note]));

    component.openCancel(note);
    expect(component.cancelling()?.id).toBe('d1');

    component.onCancelled({ ...note, cancelled: true, cancellationReason: 'Marchandise retournée' });
    refresh();

    expect(component.cancelling()).toBeNull();
    expect(component.deliveries()[0].cancelled).toBe(true);
    expect(element.textContent).toContain('Marchandise retournée');
  });

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/deliveries').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
