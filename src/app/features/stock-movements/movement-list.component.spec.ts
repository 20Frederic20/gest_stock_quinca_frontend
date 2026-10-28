import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { StockMovement } from '../../core/models/stock.model';
import { Role } from '../../core/models/user.model';
import { MovementListComponent } from './movement-list.component';

const at = '2026-09-15T08:00:00';

const cotonou: Agency = { id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at };
const porto: Agency = { ...cotonou, id: 'g2', code: 'PTN-SIEGE', label: 'Porto-Novo — Siège' };

const count: StockMovement = {
  id: 'm1', type: 'ADJUSTMENT', quantity: 8400, resultingQuantity: 8400, documentType: null, documentId: null,
  reason: 'Inventaire de fin du mois', movementDate: '2026-09-15T08:27:11', reversedMovementId: null,
  articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
  userId: 'u1', userName: 'Administrateur',
};
const reversal: StockMovement = { ...count, id: 'm2', type: 'REVERSAL', quantity: -8400, resultingQuantity: 0, reversedMovementId: 'm1' };
const sale: StockMovement = { ...count, id: 'm3', type: 'SALE', quantity: -50, resultingQuantity: 8350 };

const page = (content: StockMovement[], number = 0, totalPages = 1) =>
  ({ content, number, totalPages, totalElements: content.length, size: 20 });

describe('MovementListComponent', () => {
  let httpTesting: HttpTestingController;

  const movementsRequest = (agencyId = 'g1'): TestRequest =>
    httpTesting.expectOne(r => r.url === `/api/v1/agencies/${agencyId}/stock-movements`);

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

    const fixture = TestBed.createComponent(MovementListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([cotonou, porto]);

    return fixture.componentInstance;
  }

  afterEach(() => httpTesting.verify());

  it('opens on the full history of the user’s own agency, with no date filter', () => {
    const component = setup();
    expect(component.loading()).toBe(true);

    const req = movementsRequest();
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.has('articleId')).toBe(false);
    expect(req.request.params.has('startDate')).toBe(false);
    req.flush(page([reversal, count], 0, 4));

    expect(component.movements()).toEqual([reversal, count]);
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 4, totalElements: 2 });
  });

  it('loads the requested page', () => {
    const component = setup();
    movementsRequest().flush(page([count], 0, 4));

    component.load(3);

    expect(movementsRequest().request.params.get('page')).toBe('3');
  });

  it('filters on one article from the first page, and removes the filter', () => {
    const component = setup();
    movementsRequest().flush(page([count], 2, 4));

    component.onArticleFilter({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    const filtered = movementsRequest();
    expect(filtered.request.params.get('articleId')).toBe('a1');
    expect(filtered.request.params.get('page')).toBe('0');
    filtered.flush(page([count]));

    component.onArticleFilter(null);
    expect(movementsRequest().request.params.has('articleId')).toBe(false);
  });

  it('narrows to a day or a period, combined with the article filter', () => {
    const component = setup();
    movementsRequest().flush(page([count]));

    component.onArticleFilter({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    movementsRequest().flush(page([count]));

    component.onDateFromChange('2026-09-20');
    let req = movementsRequest();
    expect(req.request.params.get('articleId')).toBe('a1');
    expect(req.request.params.get('startDate')).toBe('2026-09-20');
    expect(req.request.params.has('endDate')).toBe(false);
    req.flush(page([count]));

    component.onDateToChange('2026-09-25');
    req = movementsRequest();
    expect(req.request.params.get('startDate')).toBe('2026-09-20');
    expect(req.request.params.get('endDate')).toBe('2026-09-25');
    req.flush(page([count]));

    // A start date after the current end date makes no sense as a period: the end date is dropped.
    component.onDateFromChange('2026-09-30');
    expect(component.dateTo()).toBe('');
    req = movementsRequest();
    expect(req.request.params.has('endDate')).toBe(false);
    req.flush(page([count]));
  });

  it('resets the article and date filters back to the full unfiltered history', () => {
    const component = setup();
    movementsRequest().flush(page([count]));
    component.onArticleFilter({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    movementsRequest().flush(page([count]));
    component.onDateToChange('2026-09-25');
    movementsRequest().flush(page([count]));

    component.resetFilters();

    expect(component.articleFilter()).toBeNull();
    expect(component.dateFrom()).toBe('');
    expect(component.dateTo()).toBe('');
    const req = movementsRequest();
    expect(req.request.params.has('articleId')).toBe(false);
    expect(req.request.params.has('startDate')).toBe(false);
    expect(req.request.params.has('endDate')).toBe(false);
    req.flush(page([]));
  });

  it('switches to another agency, keeping the article filter and reloading', () => {
    const component = setup();
    movementsRequest().flush(page([]));
    component.onArticleFilter({ id: 'a1', label: 'CIM-32R' });
    movementsRequest().flush(page([]));

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    const req = movementsRequest('g2');
    expect(req.request.params.get('articleId')).toBe('a1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([]));
  });

  it('ignores the answer of an outdated request', () => {
    const component = setup();
    const first = movementsRequest();

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    expect(first.cancelled).toBe(true);
    movementsRequest('g2').flush(page([]));
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    movementsRequest().flush(
      { status: 403, message: 'Vous n’avez pas les droits nécessaires', fieldErrors: null },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(component.error()).toBe('Vous n’avez pas les droits nécessaires');
  });

  it('knows which movements of the page were cancelled', () => {
    const component = setup();
    movementsRequest().flush(page([reversal, sale, count]));

    expect(component.isReversed(count)).toBe(true);
    expect(component.isReversed(sale)).toBe(false);
    expect(component.isReversed(reversal)).toBe(false);
  });

  it('opens the sheet, then the reversal, and cancelling goes back to the sheet', () => {
    const component = setup();
    movementsRequest().flush(page([sale]));

    component.openDetail(sale);
    expect(component.drawerMode()).toBe('detail');

    component.openReversal();
    expect(component.drawerMode()).toBe('reversal');
    expect(component.selectedMovement()).toBe(sale);

    component.onReversalCancelled();
    expect(component.drawerMode()).toBe('detail');
  });

  it('closes, confirms and reloads the first page after a reversal, where it now appears', () => {
    const component = setup();
    movementsRequest().flush(page([sale], 2, 4));
    component.openDetail(sale);
    component.openReversal();

    component.onReversed();

    expect(component.drawerOpen()).toBe(false);
    expect(component.notice()).toBe('Mouvement annulé.');
    expect(movementsRequest().request.params.get('page')).toBe('0');
  });

  it('summarises a movement for the reversal form', () => {
    const component = setup();
    movementsRequest().flush(page([count]));

    expect(component.summary(count).replace(/\s/g, ' ')).toBe('Inventaire du 15/09/2026 08:27 : +8 400 (Ciment CIM II 32.5R)');
  });

  it('lets every logged-in user cancel while permissions are disabled', () => {
    const component = setup('SELLER');
    movementsRequest().flush(page([]));

    expect(component.canAct()).toBe(true);
    expect(component.canChooseAgency()).toBe(true);
  });

  it('with permissions enabled, lets a manager cancel only in their own agency', () => {
    const component = setup('MANAGER', true);
    movementsRequest().flush(page([]));
    expect(component.canAct()).toBe(true);

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });
    movementsRequest('g2').flush(page([]));
    expect(component.canAct()).toBe(false);
  });
});
