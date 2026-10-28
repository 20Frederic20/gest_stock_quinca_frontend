import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Supplier } from '../../core/models/supplier.model';
import { Role } from '../../core/models/user.model';
import { SupplierListComponent } from './supplier-list.component';

const at = '2026-09-16T08:00:00';
const cements: Supplier = {
  id: 'f1', code: 'FOU-001', companyName: 'Ciments du Bénin', address: 'Zone industrielle, Cotonou',
  phone: '+229 21 30 00 00', taxId: '3201900000002', paymentTerms: '30 jours fin de mois', active: true,
  createdAt: at, updatedAt: at,
};

const page = (content: Supplier[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });

describe('SupplierListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(role: Role = 'MANAGER') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role, agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });

    const fixture = TestBed.createComponent(SupplierListComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();

    return { component: fixture.componentInstance, element, refresh };
  }

  afterEach(() => httpTesting.verify());

  it('lists the suppliers on opening', () => {
    const { component, element, refresh } = setup();

    const request = httpTesting.expectOne(r => r.url === '/api/v1/suppliers');
    expect(request.request.params.get('page')).toBe('0');
    request.flush(page([cements]));
    refresh();

    expect(component.suppliers()).toEqual([cements]);
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 1, totalElements: 1 });
    expect(element.querySelector('tbody')?.textContent).toContain('Ciments du Bénin');
  });

  it('searches and starts again from the first page', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));

    component.onSearch('ciment');

    const search = httpTesting.expectOne(r => r.url === '/api/v1/suppliers/search');
    expect(search.request.params.get('term')).toBe('ciment');
    expect(search.request.params.get('page')).toBe('0');
    search.flush(page([]));

    expect(component.emptyMessage()).toContain('recherche');
  });

  it('opens the sheet of a supplier, then its form', () => {
    const { component, element, refresh } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));

    component.openDetail(cements);
    refresh();
    expect(component.drawerHeading()).toBe('Ciments du Bénin');
    expect(element.querySelector('app-supplier-detail')).not.toBeNull();

    component.openEdit();
    refresh();
    expect(component.drawerHeading()).toBe('Modifier le fournisseur');
    expect(element.querySelector('app-supplier-form')).not.toBeNull();
  });

  it('opens an empty form for a new supplier', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));

    component.openCreate();

    expect(component.selectedSupplier()).toBeNull();
    expect(component.drawerHeading()).toBe('Nouveau fournisseur');
  });

  it('loads the list again once a supplier was saved', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([]));

    component.onSaved();

    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));
    expect(component.drawerOpen()).toBe(false);
    expect(component.suppliers()).toEqual([cements]);
  });

  it('deactivates a supplier in place, without reloading the page', () => {
    const { component } = setup();
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));
    component.openDetail(cements);

    component.toggleActive();

    const request = httpTesting.expectOne('/api/v1/suppliers/f1/deactivate');
    expect(request.request.method).toBe('PATCH');
    request.flush({ ...cements, active: false });

    expect(component.suppliers()[0].active).toBe(false);
    expect(component.selectedSupplier()?.active).toBe(false);
  });

  it('deletes only after confirmation, then loads the list again', () => {
    const { component } = setup('ADMIN');
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));
    component.openDetail(cements);

    component.askDelete();
    httpTesting.expectNone('/api/v1/suppliers/f1');
    expect(component.deleteMessage()).toContain('Ciments du Bénin');

    component.confirmDelete();
    httpTesting.expectOne('/api/v1/suppliers/f1').flush(null);

    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([]));
    expect(component.drawerOpen()).toBe(false);
  });

  it('shows why a deletion was refused, keeping the list in place', () => {
    const { component } = setup('ADMIN');
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));
    component.openDetail(cements);
    component.askDelete();

    component.confirmDelete();
    httpTesting.expectOne('/api/v1/suppliers/f1').flush(
      { status: 409, message: 'Ce fournisseur a des commandes enregistrées', fieldErrors: null },
      { status: 409, statusText: 'Conflict' },
    );

    expect(component.actionError()).toContain('commandes enregistrées');
    expect(component.suppliers()).toEqual([cements]);
  });

  it('lets a manager keep the suppliers but not delete one', () => {
    const { component } = setup('MANAGER');
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));

    expect(component.canEdit()).toBe(true);
    expect(component.canDelete()).toBe(false);
  });

  it('lets a seller read them, nothing more', () => {
    const { component } = setup('SELLER');
    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(page([cements]));

    expect(component.canEdit()).toBe(false);
    expect(component.canDelete()).toBe(false);
  });

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne(r => r.url === '/api/v1/suppliers').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
