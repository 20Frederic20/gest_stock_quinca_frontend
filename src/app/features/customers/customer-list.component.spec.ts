import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { Privilege } from '../../core/models/privilege.model';
import { CustomerListComponent } from './customer-list.component';

const URL = '/api/customers';
const at = '2026-09-15T08:00:00';

const privilege: Privilege = { id: 'p1', label: 'Standard', isDefault: true, createdAt: at, updatedAt: at };
const customer: Customer = {
  id: 'c1', code: 'CLI-001', name: 'Bâtiments Houngbo', type: 'COMPANY', phone: '+229 97 00 00 01', address: null,
  taxId: null, creditLimit: 500000, paymentTermDays: 30, comment: null, active: true,
  privilegeId: 'p1', privilegeLabel: 'Standard', createdAt: at, updatedAt: at,
};
const other: Customer = { ...customer, id: 'c2', code: 'CLI-002', name: 'Awa Dossou', type: 'INDIVIDUAL', creditLimit: 0 };
const credit: CustomerCredit = {
  customerId: 'c1', customerName: 'Bâtiments Houngbo', creditLimit: 500000, currentBalance: 0,
  remainingCredit: 500000, paymentTermDays: 30, creditAllowed: true,
};

const page = (content: Customer[], number = 0, totalPages = 1) =>
  ({ content, totalElements: content.length, totalPages, number, size: 20 });

describe('CustomerListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'ADMIN', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });

    const fixture = TestBed.createComponent(CustomerListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/privileges').flush([privilege]);

    return fixture.componentInstance;
  }

  const expectList = (page: string) =>
    httpTesting.expectOne(r => r.url === URL && r.params.get('page') === page);

  afterEach(() => httpTesting.verify());

  it('loads the first page and the price grids when the screen opens', () => {
    const component = setup();
    expect(component.loading()).toBe(true);

    expectList('0').flush(page([customer, other]));

    expect(component.customers()).toEqual([customer, other]);
    expect(component.privileges()).toEqual([privilege]);
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 1, totalElements: 2 });
    expect(component.loading()).toBe(false);
  });

  it('searches from the first page, and lists everything again once the term is cleared', () => {
    const component = setup();
    expectList('0').flush(page([customer, other]));

    component.onSearch('houn');
    const req = httpTesting.expectOne(r => r.url === `${URL}/search`);
    expect(req.request.params.get('term')).toBe('houn');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([]));
    expect(component.emptyMessage()).toBe('Aucun client ne correspond à cette recherche.');

    component.onSearch('');
    expectList('0').flush(page([customer, other]));
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    expectList('0').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });

  it('opens the sheet and loads the credit situation', () => {
    const component = setup();
    expectList('0').flush(page([customer]));

    component.openDetail(customer);
    expect(component.drawerHeading()).toBe('Bâtiments Houngbo');
    expect(component.creditLoading()).toBe(true);

    httpTesting.expectOne(`${URL}/c1/credit`).flush(credit);
    expect(component.credit()).toEqual(credit);
    expect(component.creditLoading()).toBe(false);
  });

  it('keeps the sheet open when the credit cannot be loaded', () => {
    const component = setup();
    expectList('0').flush(page([customer]));
    component.openDetail(customer);

    httpTesting.expectOne(`${URL}/c1/credit`).flush(
      { status: 404, message: 'Client introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.drawerOpen()).toBe(true);
    expect(component.creditError()).toBe('Client introuvable');
  });

  it('goes back to the sheet when an edit is cancelled, and closes when a creation is', () => {
    const component = setup();
    expectList('0').flush(page([customer]));
    component.openDetail(customer);
    httpTesting.expectOne(`${URL}/c1/credit`).flush(credit);

    component.openEdit();
    expect(component.drawerHeading()).toBe('Modifier le client');
    component.onFormCancelled();
    expect(component.drawerMode()).toBe('detail');

    component.openCreate();
    expect(component.drawerHeading()).toBe('Nouveau client');
    component.onFormCancelled();
    expect(component.drawerOpen()).toBe(false);
  });

  it('closes the drawer and reloads the current page after saving', () => {
    const component = setup();
    expectList('0').flush(page([customer], 0, 3));
    component.load(2);
    expectList('2').flush(page([customer], 2, 3));
    component.openCreate();

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    expectList('2').flush(page([customer, other], 2, 3));
  });

  it('deactivates a customer, updates the row and asks the credit again', () => {
    const component = setup();
    expectList('0').flush(page([customer, other]));
    component.openDetail(customer);
    httpTesting.expectOne(`${URL}/c1/credit`).flush(credit);

    component.toggleActive();

    const req = httpTesting.expectOne(`${URL}/c1/deactivate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...customer, active: false });

    expect(component.selectedCustomer()?.active).toBe(false);
    expect(component.customers()[0].active).toBe(false);
    httpTesting.expectOne(`${URL}/c1/credit`).flush({ ...credit, creditAllowed: false });
    expect(component.credit()?.creditAllowed).toBe(false);
  });

  it('deletes only after confirmation, then goes back a page when its last customer is gone', () => {
    const component = setup();
    expectList('0').flush(page([customer], 0, 2));
    component.load(1);
    expectList('1').flush(page([other], 1, 2));
    component.openDetail(other);
    httpTesting.expectOne(`${URL}/c2/credit`).flush({ ...credit, customerId: 'c2' });

    component.askDelete();
    httpTesting.expectNone(`${URL}/c2`);
    expect(component.deleteMessage()).toContain('Awa Dossou');

    component.confirmDelete();
    const req = httpTesting.expectOne(`${URL}/c2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.drawerOpen()).toBe(false);
    expectList('0').flush(page([customer]));
  });

  it('keeps the list visible when the backend refuses a deletion', () => {
    const component = setup();
    expectList('0').flush(page([customer]));
    component.openDetail(customer);
    httpTesting.expectOne(`${URL}/c1/credit`).flush(credit);

    component.askDelete();
    component.confirmDelete();
    httpTesting.expectOne(`${URL}/c1`).flush(
      { status: 400, message: 'Impossible de supprimer ce client : il reste un encours de 12000', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toContain('encours');
    expect(component.error()).toBeNull();
    expect(component.customers()).toEqual([customer]);
  });
});
