import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { AgencyStock } from '../../core/models/stock.model';
import { Role } from '../../core/models/user.model';
import { StockListComponent } from './stock-list.component';

const at = '2026-09-15T08:00:00';

const cotonou: Agency = { id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at };
const porto: Agency = { ...cotonou, id: 'g2', code: 'PTN-SIEGE', label: 'Porto-Novo — Siège' };

const cement: AgencyStock = {
  id: 's1', articleId: 'a1', articleCode: 'CIM-32R', articleDesignation: 'Ciment CIM II 32.5R',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', stockUnitCode: 'KG',
  quantity: 120, reservedQuantity: 20, availableQuantity: 100, alertThreshold: 2000, belowThreshold: true, updatedAt: at,
};
const rebar: AgencyStock = { ...cement, id: 's2', articleId: 'a2', articleCode: 'FER-8', articleDesignation: 'Fer à béton', belowThreshold: false };

const page = (content: AgencyStock[], number = 0, totalPages = 1) =>
  ({ content, number, totalPages, totalElements: content.length, size: 20 });

describe('StockListComponent', () => {
  let httpTesting: HttpTestingController;

  const stockRequest = (agencyId = 'g1'): TestRequest =>
    httpTesting.expectOne(r => r.url === `/api/v1/agencies/${agencyId}/stock`);

  function setup(role: Role = 'ADMIN', permissionsEnabled = false) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: permissionsEnabled },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Administrateur', username: 'admin', role, agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });

    const fixture = TestBed.createComponent(StockListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([cotonou, porto]);

    return fixture.componentInstance;
  }

  afterEach(() => httpTesting.verify());

  it('opens on the stock of the user’s own agency', () => {
    const component = setup();
    expect(component.agencyId()).toBe('g1');
    expect(component.loading()).toBe(true);

    const req = stockRequest();
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([cement, rebar], 0, 3));

    expect(component.lines()).toEqual([cement, rebar]);
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 3, totalElements: 2 });
    expect(component.agencyOptions().map(o => o.label)).toEqual(['Cotonou — Siège', 'Porto-Novo — Siège']);
  });

  it('loads the requested page', () => {
    const component = setup();
    stockRequest().flush(page([cement], 0, 3));

    component.load(2);

    expect(stockRequest().request.params.get('page')).toBe('2');
  });

  it('switches to another agency from its first page', () => {
    const component = setup();
    stockRequest().flush(page([cement], 1, 3));

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    expect(component.agencyId()).toBe('g2');
    expect(stockRequest('g2').request.params.get('page')).toBe('0');
  });

  it('shows only the lines below their threshold, without pagination', () => {
    const component = setup();
    stockRequest().flush(page([cement, rebar]));

    component.setAlertsOnly(true);
    httpTesting.expectOne('/api/v1/agencies/g1/stock/alerts').flush([cement]);

    expect(component.lines()).toEqual([cement]);
    expect(component.pageInfo()).toBeNull();

    component.setAlertsOnly(false);
    stockRequest().flush(page([cement, rebar]));
    expect(component.lines()).toEqual([cement, rebar]);
  });

  it('ignores the answer of an outdated request', () => {
    const component = setup();
    const first = stockRequest();

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    expect(first.cancelled).toBe(true);
    stockRequest('g2').flush(page([]));
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    stockRequest().flush(
      { status: 403, message: 'Vous n’avez pas les droits nécessaires', fieldErrors: null },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(component.error()).toBe('Vous n’avez pas les droits nécessaires');
    expect(component.loading()).toBe(false);
  });

  it('opens the sheet of a line, then its inventory, and cancelling goes back', () => {
    const component = setup();
    stockRequest().flush(page([cement]));

    component.openDetail(cement);
    expect(component.drawerMode()).toBe('detail');

    component.openInventory();
    expect(component.drawerMode()).toBe('inventory');
    expect(component.selectedLine()).toBe(cement);

    component.onInventoryCancelled();
    expect(component.drawerMode()).toBe('detail');
  });

  it('opens an inventory on an article to choose, and cancelling closes', () => {
    const component = setup();
    stockRequest().flush(page([]));

    component.openNewInventory();
    expect(component.drawerMode()).toBe('inventory');
    expect(component.selectedLine()).toBeNull();

    component.onInventoryCancelled();
    expect(component.drawerOpen()).toBe(false);
  });

  it('closes the drawer, confirms and reloads the current page after an inventory', () => {
    const component = setup();
    stockRequest().flush(page([cement], 1, 3));
    component.openDetail(cement);
    component.openInventory();

    component.onInventorySaved();

    expect(component.drawerOpen()).toBe(false);
    expect(component.notice()).toBe('Inventaire enregistré.');
    expect(stockRequest().request.params.get('page')).toBe('1');
  });

  it('lets every logged-in user count stock while permissions are disabled', () => {
    const component = setup('SELLER');
    stockRequest().flush(page([]));

    expect(component.canAct()).toBe(true);
    expect(component.canChooseAgency()).toBe(true);
  });

  it('with permissions enabled, lets a seller look at any agency’s stock but stay read-only', () => {
    const component = setup('SELLER', true);
    stockRequest().flush(page([]));

    expect(component.canChooseAgency()).toBe(true);
    expect(component.canAct()).toBe(false);

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });
    stockRequest('g2').flush(page([]));
    expect(component.canAct()).toBe(false);
  });

  it('with permissions enabled, lets a manager count only in their own agency', () => {
    const component = setup('MANAGER', true);
    stockRequest().flush(page([]));
    expect(component.canAct()).toBe(true);

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });
    stockRequest('g2').flush(page([]));
    expect(component.canChooseAgency()).toBe(true);
    expect(component.canAct()).toBe(false);
  });
});
