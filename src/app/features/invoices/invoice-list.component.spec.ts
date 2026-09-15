import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Invoice } from '../../core/models/invoice.model';
import { Role } from '../../core/models/user.model';
import { InvoiceListComponent } from './invoice-list.component';

const at = '2026-09-15T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});
const draft = {
  id: 'i1', number: 'FAC-COT-2026-00001', type: 'INVOICE', status: 'DRAFT', documentDate: '2026-09-15',
  totalAmount: 59000, creditMode: false, customerName: 'Bâtiments Houngbo', lines: [],
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

    return { component: fixture.componentInstance, navigate };
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

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
