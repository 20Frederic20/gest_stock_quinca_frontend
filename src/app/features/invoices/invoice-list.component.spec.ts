import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Invoice } from '../../core/models/invoice.model';
import { Payment } from '../../core/models/payment.model';
import { Role } from '../../core/models/user.model';
import { formatMoney } from '../pricing/price-rules';
import { InvoiceListComponent } from './invoice-list.component';

const at = '2026-09-15T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});
const draft = {
  id: 'i1', number: 'FAC-COT-2026-00001', type: 'INVOICE', status: 'DRAFT', documentDate: '2026-09-15',
  totalAmount: 59000, creditMode: false, customerName: 'Bâtiments Houngbo', lines: [],
} as unknown as Invoice;

const validated = {
  ...draft, id: 'i2', number: 'FAC-COT-2026-00002', status: 'VALIDATED', paidAmount: 0,
  remainingToPay: 59000, deliveryStatus: 'NOT_DELIVERED',
} as unknown as Invoice;

const page = (content: Invoice[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });

describe('InvoiceListComponent', () => {
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

    const fixture = TestBed.createComponent(InvoiceListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou — Siège'), agency('g2', 'Parakou')]);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    /** The labelled action buttons of one row, in order (the icon-only preview button is separate). */
    const rowActions = (row = 0) =>
      [...element.querySelectorAll('tbody tr')[row].querySelectorAll('.row-actions button:not(.icon-btn)')]
        .map(button => button.textContent?.trim());

    return { component: fixture.componentInstance, element, refresh, rowActions, navigate };
  }

  afterEach(() => httpTesting.verify());

  it('lists the documents of the user’s own agency', () => {
    const { component } = setup();

    const req = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([draft]));

    expect(component.invoices()).toEqual([draft]);
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 1, totalElements: 1 });
  });

  it('lets a manager look at another agency, not a seller', () => {
    const seller = setup('SELLER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([]));
    expect(seller.component.canChooseAgency()).toBe(false);
    expect(seller.component.canCreate()).toBe(true);
  });

  it('switches agency and starts again from the first page', () => {
    const { component } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft]));
    expect(component.canChooseAgency()).toBe(true);

    component.onAgencySelected({ id: 'g2', label: 'Parakou' });

    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g2/invoices' && r.params.get('page') === '0').flush(page([]));
    expect(component.agencyLabel()).toBe('Parakou');
    expect(component.invoices()).toEqual([]);
  });

  it('opens a document and starts a new sale on their own page', () => {
    const { component, navigate } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft]));

    component.open(draft);
    component.newSale();

    expect(navigate).toHaveBeenCalledWith(['/invoices', 'i1']);
    expect(navigate).toHaveBeenCalledWith(['/new-sale']);
  });

  it('offers a manager to validate or delete a draft, and to cancel a validated document', () => {
    const { refresh, rowActions } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft, validated]));
    refresh();

    expect(rowActions(0)).toEqual(['Valider', 'Supprimer']);
    expect(rowActions(1)).toEqual(['Encaisser', 'Annuler']);
  });

  it('lets a seller validate and collect, but neither delete nor cancel', () => {
    const { refresh, rowActions } = setup('SELLER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft, validated]));
    refresh();

    expect(rowActions(0)).toEqual(['Valider']);
    expect(rowActions(1)).toEqual(['Encaisser']);
  });

  it('validates a draft from the list after confirmation and updates its row', () => {
    const { component, refresh } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft]));

    component.askValidation(draft);
    httpTesting.expectNone('/api/v1/invoices/i1/validation');
    expect(component.confirmMessage()).toContain(formatMoney(59000));

    component.validate();
    httpTesting.expectOne('/api/v1/invoices/i1/validation').flush({ ...draft, status: 'VALIDATED' });
    refresh();

    expect(component.invoices()[0].status).toBe('VALIDATED');
    expect(component.actionError()).toBeNull();
  });

  it('deletes a draft from the list after confirmation and loads the page again', () => {
    const { component } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft]));

    component.askDelete(draft);
    httpTesting.expectNone('/api/v1/invoices/i1');

    component.deleteDraft();
    const request = httpTesting.expectOne('/api/v1/invoices/i1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    // The page is loaded again: the totals of the pagination must not go stale.
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([]));

    expect(component.invoices()).toEqual([]);
  });

  it('cancels a validated document from the list and updates its row', () => {
    const { component } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([validated]));

    component.openCancel(validated);
    expect(component.cancelling()?.id).toBe('i2');

    component.onCancelled({ ...validated, status: 'CANCELLED', cancellationReason: 'Erreur de client' });

    expect(component.cancelling()).toBeNull();
    expect(component.invoices()[0].status).toBe('CANCELLED');
  });

  it('keeps the row as it was when the backend refuses the validation', () => {
    const { component } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft]));

    component.askValidation(draft);
    component.validate();
    httpTesting.expectOne('/api/v1/invoices/i1/validation').flush(
      { status: 400, message: 'Stock insuffisant pour « Ciment CIM II 32.5R »', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toContain('Stock insuffisant');
    expect(component.invoices()[0].status).toBe('DRAFT');
  });

  it('offers to collect a validated invoice that still owes something', () => {
    const { refresh, rowActions } = setup('MANAGER');
    const paid = { ...validated, id: 'i3', paidAmount: 59000, remainingToPay: 0 } as Invoice;
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft, validated, paid]));
    refresh();

    expect(rowActions(0)).toEqual(['Valider', 'Supprimer']);
    expect(rowActions(1)).toEqual(['Encaisser', 'Annuler']);
    // Nothing left to collect, and a paid invoice can no longer be cancelled.
    expect(rowActions(2)).toEqual([]);
  });

  it('collects from the list and updates the row with what the invoice still owes', () => {
    const { component, refresh } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([validated]));

    component.openPayment(validated);
    expect(component.collecting()?.id).toBe('i2');
    refresh();

    component.onPaymentTaken({
      id: 'p1', invoiceId: 'i2', amount: 50000, invoicePaidAmount: 50000, invoiceRemainingToPay: 9000,
    } as Payment);
    refresh();

    expect(component.collecting()).toBeNull();
    expect(component.invoices()[0].paidAmount).toBe(50000);
    expect(component.invoices()[0].remainingToPay).toBe(9000);
  });

  it('previews a document’s content in the drawer without leaving the list, already loaded', () => {
    const { component, navigate } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(page([draft]));

    const event = new Event('click');
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    component.openPreview(draft, event);

    // No round trip: the invoice, lines included, was already in the list.
    httpTesting.verify();
    expect(stopPropagation).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(component.previewing()).toBe(draft);
  });

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
