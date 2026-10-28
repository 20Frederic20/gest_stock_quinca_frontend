import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Dashboard } from '../../core/models/dashboard.model';
import { DayClosing } from '../../core/models/day-closing.model';
import { Invoice } from '../../core/models/invoice.model';
import { AgencyStock, StockMovement } from '../../core/models/stock.model';
import { Role } from '../../core/models/user.model';
import { DashboardComponent } from './dashboard.component';

const at = '2026-09-17T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});

const figures: Dashboard = {
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', date: '2026-09-17',
  invoicesToday: 4, salesToday: 268000, collectedToday: 150000, cashCollectedToday: 90000,
  draftDocuments: 2, invoicesToDeliver: 3, outstandingTotal: 420000, ordersToReceive: 1, stockAlerts: 5,
};

const openDayClosing: DayClosing = {
  id: 'dc1', agencyId: 'g1', agencyLabel: 'Cotonou — Siège', closingDate: '2026-09-17', startTime: '08:00:00',
  endTime: null, closed: false, openingCashAmount: 20000, theoreticalTotal: 20000, countedTotal: null,
  variance: null, comment: null, openedByUserId: 'u1', openedByUserName: 'Awa Dossou',
  closedByUserId: null, closedByUserName: null, createdAt: at,
};

describe('DashboardComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(role: Role = 'MANAGER') {
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

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou — Siège'), agency('g2', 'Parakou')]);

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const text = () => element.textContent?.replace(/\s+/g, ' ') ?? '';

    return { component: fixture.componentInstance, element, refresh, text };
  }

  /** No cash session open for the agency: what a fresh day looks like before anyone opens the till. */
  function flushNoDayClosing(agencyId: string) {
    httpTesting.expectOne(`/api/v1/agencies/${agencyId}/day-closings/current`).flush(
      { status: 404, message: 'Aucune journée de caisse ouverte pour cette agence', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );
  }

  /**
   * The three supplementary panels the dashboard also loads alongside the main figures, plus the
   * day-closing status — only a role that holds the till (not a seller) triggers that last call.
   */
  function flushPanels(agencyId: string, expectDayClosing = true) {
    httpTesting.expectOne(`/api/v1/agencies/${agencyId}/stock/alerts`).flush([]);
    httpTesting.expectOne(r => r.url === `/api/v1/agencies/${agencyId}/stock-movements`).flush({
      content: [], totalElements: 0, totalPages: 0, number: 0, size: 5,
    });
    httpTesting.expectOne(r => r.url === `/api/v1/agencies/${agencyId}/invoices`).flush({
      content: [], totalElements: 0, totalPages: 0, number: 0, size: 20,
    });
    if (expectDayClosing) {
      flushNoDayClosing(agencyId);
    }
  }

  afterEach(() => httpTesting.verify());

  it('shows what the agency sold and collected today', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    flushPanels('g1');
    refresh();

    expect(text()).toContain('268 000');
    expect(text()).toContain('4 factures');
    expect(text()).toContain('150 000');
    // The cash part is what the till has to hold at closing time.
    expect(text()).toContain('90 000');
  });

  it('shows what is still waiting, each with the way to it', () => {
    const { element, text, refresh } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    flushPanels('g1');
    refresh();

    expect(text()).toContain('420 000');
    const links = [...element.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(links).toContain('/invoices');
    expect(links).toContain('/receptions');
    expect(links).toContain('/stock');
  });

  it('says plainly when there is nothing waiting', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush({
      ...figures, draftDocuments: 0, invoicesToDeliver: 0, ordersToReceive: 0, stockAlerts: 0,
    });
    flushPanels('g1');
    refresh();

    expect(text()).toContain('Rien n’attend');
  });

  it('follows the agency a manager chooses', () => {
    const { component } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    flushPanels('g1');

    component.onAgencySelected({ id: 'g2', label: 'Parakou' });

    httpTesting.expectOne('/api/v1/agencies/g2/dashboard').flush({ ...figures, agencyId: 'g2' });
    flushPanels('g2');
    expect(component.figures()?.agencyId).toBe('g2');
  });

  it('keeps a seller on their own agency', () => {
    const { component } = setup('SELLER');
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    flushPanels('g1', false);

    expect(component.canChooseAgency()).toBe(false);
  });

  it('shows the count of stock alerts as a headline figure', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    flushPanels('g1');
    refresh();

    expect(text()).toContain('Alertes stock');
    expect(text()).toContain('5');
  });

  it('lists the articles below their alert threshold', () => {
    const { text, refresh } = setup();
    const alert: AgencyStock = {
      id: 'as1', articleId: 'a1', articleCode: 'ART-0014', articleDesignation: 'Fer à béton HA 12 mm — barre 12 m',
      agencyId: 'g1', agencyLabel: 'Cotonou — Siège', stockUnitCode: 'BAR',
      quantity: 72, reservedQuantity: 0, availableQuantity: 72, alertThreshold: 120, belowThreshold: true, updatedAt: at,
    };
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    httpTesting.expectOne('/api/v1/agencies/g1/stock/alerts').flush([alert]);
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
    flushNoDayClosing('g1');
    refresh();

    expect(text()).toContain('Fer à béton HA 12 mm');
    expect(text()).toContain('72 BAR');
    expect(text()).toContain('120 BAR');
  });

  it('lists the most recent stock movements', () => {
    const { text, refresh } = setup();
    const movement: StockMovement = {
      id: 'm1', type: 'SALE', quantity: -60, resultingQuantity: 72, documentType: 'INVOICE', documentId: 'i1',
      reason: null, movementDate: '2026-09-17T11:05:00', reversedMovementId: null,
      articleId: 'a1', articleDesignation: 'Fer à béton HA 12 mm', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
      userId: 'u1', userName: 'Awa Dossou',
    };
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    httpTesting.expectOne('/api/v1/agencies/g1/stock/alerts').flush([]);
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements').flush({ content: [movement], totalElements: 1, totalPages: 1, number: 0, size: 5 });
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
    flushNoDayClosing('g1');
    refresh();

    expect(text()).toContain('Fer à béton HA 12 mm');
    expect(text()).toContain('Vente');
  });

  it('lists the most recent invoices with their delivery status', () => {
    const { text, refresh } = setup();
    const invoice: Invoice = {
      id: 'i1', number: 'FAC-000125', type: 'INVOICE', status: 'VALIDATED', deliveryStatus: 'PARTIALLY_DELIVERED',
      documentDate: '2026-09-17', dueDate: null, grossAmount: 1258500, discountAmount: 0, netAmount: 1258500,
      vatAmount: 0, transportAmount: 0, totalAmount: 1258500, paidAmount: 0, remainingToPay: 1258500,
      creditMode: false, cancellationReason: null, customerId: 'c1', customerName: 'ETS SODJI & Frères',
      agencyId: 'g1', agencyLabel: 'Cotonou — Siège', userId: 'u1', userName: 'Awa Dossou', lines: [], createdAt: at,
    };
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
    httpTesting.expectOne('/api/v1/agencies/g1/stock/alerts').flush([]);
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush({ content: [invoice], totalElements: 1, totalPages: 1, number: 0, size: 20 });
    flushNoDayClosing('g1');
    refresh();

    expect(text()).toContain('FAC-000125');
    expect(text()).toContain('ETS SODJI & Frères');
    expect(text()).toContain('1 258 500');
    expect(text()).toContain('Partiel');
  });

  it('shows the error message when the figures cannot be loaded', () => {
    const { component } = setup();

    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );
    flushPanels('g1');

    expect(component.error()).toBe('Erreur interne du serveur');
  });

  describe('day-closing banner', () => {
    it('offers to open the till when none is open yet, for a role that holds it', () => {
      const { component, text, refresh } = setup('CASHIER');
      httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
      flushPanels('g1');
      refresh();

      expect(component.showOpenBanner()).toBe(true);
      expect(text()).toContain('Aucune caisse n’est ouverte');
      expect(text()).toContain('Ouvrir la caisse');
    });

    it('hides the banner once a session is open, and drops it from the figures request', () => {
      const { component, text, refresh } = setup('CASHIER');
      httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
      httpTesting.expectOne('/api/v1/agencies/g1/stock/alerts').flush([]);
      httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
      httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/invoices').flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
      httpTesting.expectOne('/api/v1/agencies/g1/day-closings/current').flush(openDayClosing);
      refresh();

      expect(component.showOpenBanner()).toBe(false);
      expect(text()).not.toContain('Aucune caisse n’est ouverte');
    });

    it('never asks about the till for a seller, who does not hold it', () => {
      const { component } = setup('SELLER');
      httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
      flushPanels('g1', false);

      expect(component.canOpenDayClosing()).toBe(false);
      expect(component.showOpenBanner()).toBe(false);
    });

    it('opens the drawer from the banner and hides it once the till is declared open', () => {
      const { component, refresh } = setup('CASHIER');
      httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
      flushPanels('g1');
      refresh();

      component.openDayClosingDrawer();
      expect(component.showOpenDrawer()).toBe(true);

      component.onDayClosingOpened(openDayClosing);
      refresh();

      expect(component.showOpenDrawer()).toBe(false);
      expect(component.showOpenBanner()).toBe(false);
    });
  });
});
