import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Dashboard } from '../../core/models/dashboard.model';
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

  afterEach(() => httpTesting.verify());

  it('shows what the agency sold and collected today', () => {
    const { text, refresh } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);
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
    refresh();

    expect(text()).toContain('Rien n’attend');
  });

  it('follows the agency a manager chooses', () => {
    const { component } = setup();
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);

    component.onAgencySelected({ id: 'g2', label: 'Parakou' });

    httpTesting.expectOne('/api/v1/agencies/g2/dashboard').flush({ ...figures, agencyId: 'g2' });
    expect(component.figures()?.agencyId).toBe('g2');
  });

  it('keeps a seller on their own agency', () => {
    const { component } = setup('SELLER');
    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(figures);

    expect(component.canChooseAgency()).toBe(false);
  });

  it('shows the error message when the figures cannot be loaded', () => {
    const { component } = setup();

    httpTesting.expectOne('/api/v1/agencies/g1/dashboard').flush(
      { status: 500, message: 'Erreur interne du serveur', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne du serveur');
  });
});
