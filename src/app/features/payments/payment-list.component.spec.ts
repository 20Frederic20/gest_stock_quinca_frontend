import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Payment } from '../../core/models/payment.model';
import { Role } from '../../core/models/user.model';
import { PaymentListComponent } from './payment-list.component';

const at = '2026-09-16T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});

const cheque = {
  id: 'p1', number: 'REG-COT-2026-00001', method: 'CHECK', amount: 50000, externalReference: '4412887',
  paymentDate: '2026-09-16', cancelled: false, cancellationReason: null,
  invoiceId: 'i1', invoiceNumber: 'FAC-COT-2026-00001', customerName: 'Bâtiments Houngbo',
  agencyId: 'g1', userName: 'Awa Dossou',
} as Payment;

const page = (content: Payment[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });

describe('PaymentListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(role: Role = 'CASHIER') {
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

    const fixture = TestBed.createComponent(PaymentListComponent);
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

  it('lists the payments of the user’s own agency, with their invoice and their method', () => {
    const { component, element, refresh } = setup();

    const request = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(page([cheque]));
    refresh();

    const text = element.querySelector('tbody')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('REG-COT-2026-00001');
    expect(text).toContain('FAC-COT-2026-00001');
    expect(text).toContain('Bâtiments Houngbo');
    expect(text).toContain('Chèque');
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 1, totalElements: 1 });
  });

  it('lets a manager look at another agency, not a cashier', () => {
    const cashier = setup('CASHIER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments').flush(page([]));
    expect(cashier.component.canChooseAgency()).toBe(false);
  });

  it('opens the invoice behind a payment', () => {
    const { component, navigate } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments').flush(page([cheque]));

    component.openInvoice(cheque);

    expect(navigate).toHaveBeenCalledWith(['/invoices', 'i1']);
  });

  it('offers the cancellation to a manager only', () => {
    const { rowActions, refresh } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments').flush(page([cheque]));
    refresh();

    expect(rowActions()).toEqual(['Annuler']);
  });

  it('offers nothing on the row to a cashier', () => {
    const { rowActions, refresh } = setup('CASHIER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments').flush(page([cheque]));
    refresh();

    expect(rowActions()).toEqual([]);
  });

  it('marks the cancelled payment on its row', () => {
    const { component, element, refresh } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments').flush(page([cheque]));

    component.openCancel(cheque);
    expect(component.cancelling()?.id).toBe('p1');

    component.onCancelled({ ...cheque, cancelled: true, cancellationReason: 'Chèque sans provision' });
    refresh();

    expect(component.cancelling()).toBeNull();
    expect(component.payments()[0].cancelled).toBe(true);
    expect(element.textContent).toContain('Chèque sans provision');
  });

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/payments').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
