import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { ArticleMovementStats, StockMovement } from '../../core/models/stock.model';
import { Role } from '../../core/models/user.model';
import { todayIso } from '../stock/stock-format';
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

const articleStats: ArticleMovementStats = {
  articleId: 'a1', articleCode: 'CIM-32R', articleDesignation: 'Ciment CIM II 32.5R', unitLabel: 'KG',
  totalIn: 8400, totalOut: 50, net: 8350, movementCount: 2, currentStock: 8350,
};

const page = (content: StockMovement[], number = 0, totalPages = 1) =>
  ({ content, number, totalPages, totalElements: content.length, size: 20 });

describe('MovementListComponent', () => {
  let httpTesting: HttpTestingController;

  const movementsRequest = (agencyId = 'g1'): TestRequest =>
    httpTesting.expectOne(r => r.url === `/api/v1/agencies/${agencyId}/stock-movements`);
  const statsRequest = (agencyId = 'g1'): TestRequest =>
    httpTesting.expectOne(r => r.url === `/api/v1/agencies/${agencyId}/stock-movements/stats`);

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

  /** Most behaviour lives in the list tab: lands on stats (empty), then switches. */
  function setupOnList(role: Role = 'ADMIN', permissionsEnabled = false) {
    const component = setup(role, permissionsEnabled);
    statsRequest().flush([]);
    component.showTab('list');
    return component;
  }

  afterEach(() => httpTesting.verify());

  it('lands on the per-article summary of today, for the user’s own agency', () => {
    const component = setup();
    expect(component.tab()).toBe('stats');
    expect(component.statsLoading()).toBe(true);

    const req = statsRequest();
    expect(req.request.params.get('startDate')).toBe(todayIso());
    expect(req.request.params.has('endDate')).toBe(false);
    req.flush([articleStats]);

    expect(component.stats()).toEqual([articleStats]);
    expect(component.statsLoading()).toBe(false);
  });

  it('drills from a stats row into that article’s movements, same period', () => {
    const component = setup();
    statsRequest().flush([articleStats]);

    component.openArticleStats(articleStats);

    expect(component.tab()).toBe('list');
    expect(component.articleFilter()).toEqual({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    const req = movementsRequest();
    expect(req.request.params.get('articleId')).toBe('a1');
    expect(req.request.params.get('startDate')).toBe(todayIso());
    req.flush(page([count]));
  });

  it('changing the start date reloads the active tab with the new day', () => {
    const component = setup();
    statsRequest().flush([]);

    component.onDateFromChange('2026-09-01');

    expect(statsRequest().request.params.get('startDate')).toBe('2026-09-01');
  });

  it('setting an end date reloads as a period; narrowing the start date past it drops the end date', () => {
    const component = setup();
    statsRequest().flush([]);

    component.onDateToChange('2026-09-25');
    let req = statsRequest();
    expect(req.request.params.get('startDate')).toBe(todayIso());
    expect(req.request.params.get('endDate')).toBe('2026-09-25');
    req.flush([]);

    // A start date after the current end date makes no sense as a period: the end date is dropped.
    component.onDateFromChange('2026-09-30');
    expect(component.dateTo()).toBe('');
    req = statsRequest();
    expect(req.request.params.has('endDate')).toBe(false);
    req.flush([]);
  });

  it('resets the article and date filters back to today, and reloads the active tab', () => {
    const component = setupOnList();
    movementsRequest().flush(page([count]));
    component.onArticleFilter({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    movementsRequest().flush(page([count]));
    component.onDateToChange('2026-09-25');
    movementsRequest().flush(page([count]));

    component.resetFilters();

    expect(component.articleFilter()).toBeNull();
    expect(component.dateFrom()).toBe(todayIso());
    expect(component.dateTo()).toBe('');
    const req = movementsRequest();
    expect(req.request.params.has('articleId')).toBe(false);
    expect(req.request.params.has('endDate')).toBe(false);
    req.flush(page([]));
  });

  it('opens on the latest movements of the user’s own agency', () => {
    const component = setupOnList();
    expect(component.loading()).toBe(true);

    const req = movementsRequest();
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.has('articleId')).toBe(false);
    req.flush(page([reversal, count], 0, 4));

    expect(component.movements()).toEqual([reversal, count]);
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 4, totalElements: 2 });
  });

  it('loads the requested page', () => {
    const component = setupOnList();
    movementsRequest().flush(page([count], 0, 4));

    component.load(3);

    expect(movementsRequest().request.params.get('page')).toBe('3');
  });

  it('filters on one article from the first page, and removes the filter', () => {
    const component = setupOnList();
    movementsRequest().flush(page([count], 2, 4));

    component.onArticleFilter({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    const filtered = movementsRequest();
    expect(filtered.request.params.get('articleId')).toBe('a1');
    expect(filtered.request.params.get('page')).toBe('0');
    filtered.flush(page([count]));

    component.onArticleFilter(null);
    expect(movementsRequest().request.params.has('articleId')).toBe(false);
  });

  it('switches to another agency, keeping the article filter and reloading the active tab', () => {
    const component = setupOnList();
    movementsRequest().flush(page([]));
    component.onArticleFilter({ id: 'a1', label: 'CIM-32R' });
    movementsRequest().flush(page([]));

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    const req = movementsRequest('g2');
    expect(req.request.params.get('articleId')).toBe('a1');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([]));
  });

  it('switching agency while on the stats tab reloads the stats, not the list', () => {
    const component = setup();
    statsRequest().flush([]);

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    statsRequest('g2').flush([]);
  });

  it('ignores the answer of an outdated request', () => {
    const component = setupOnList();
    const first = movementsRequest();

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    expect(first.cancelled).toBe(true);
    movementsRequest('g2').flush(page([]));
  });

  it('shows the error message when loading fails', () => {
    const component = setupOnList();

    movementsRequest().flush(
      { status: 403, message: 'Vous n’avez pas les droits nécessaires', fieldErrors: null },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(component.error()).toBe('Vous n’avez pas les droits nécessaires');
  });

  it('knows which movements of the page were cancelled', () => {
    const component = setupOnList();
    movementsRequest().flush(page([reversal, sale, count]));

    expect(component.isReversed(count)).toBe(true);
    expect(component.isReversed(sale)).toBe(false);
    expect(component.isReversed(reversal)).toBe(false);
  });

  it('opens the sheet, then the reversal, and cancelling goes back to the sheet', () => {
    const component = setupOnList();
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
    const component = setupOnList();
    movementsRequest().flush(page([sale], 2, 4));
    component.openDetail(sale);
    component.openReversal();

    component.onReversed();

    expect(component.drawerOpen()).toBe(false);
    expect(component.notice()).toBe('Mouvement annulé.');
    expect(movementsRequest().request.params.get('page')).toBe('0');
  });

  it('summarises a movement for the reversal form', () => {
    const component = setupOnList();
    movementsRequest().flush(page([count]));

    expect(component.summary(count).replace(/\s/g, ' ')).toBe('Inventaire du 15/09/2026 08:27 : +8 400 (Ciment CIM II 32.5R)');
  });

  it('lets every logged-in user cancel while permissions are disabled', () => {
    const component = setupOnList('SELLER');
    movementsRequest().flush(page([]));

    expect(component.canAct()).toBe(true);
    expect(component.canChooseAgency()).toBe(true);
  });

  it('with permissions enabled, lets a manager cancel only in their own agency', () => {
    const component = setupOnList('MANAGER', true);
    movementsRequest().flush(page([]));
    expect(component.canAct()).toBe(true);

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });
    movementsRequest('g2').flush(page([]));
    expect(component.canAct()).toBe(false);
  });
});
