import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { ProfitabilityReport } from '../../core/models/profitability.model';
import { presetRange } from './period-presets';
import { ProfitabilityComponent } from './profitability.component';

const at = '2026-09-16T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});

const report = (over: Partial<ProfitabilityReport> = {}): ProfitabilityReport => ({
  from: '2026-10-01', to: '2026-10-30', agencyId: null, agencyLabel: null,
  trackingStartedAt: '2026-09-01T08:00:00', beforeStart: false,
  families: [{
    familyId: 'f1', label: 'Ciment', revenue: 1000000, cost: 700000, margin: 300000, marginRate: 0.3,
    articles: [
      { articleId: 'a1', code: 'CIM-1', designation: 'Ciment 42,5', stockUnit: 'KG', quantitySold: 100,
        averageSalePrice: 10000, averagePurchasePrice: 7000, revenue: 1000000, cost: 700000, margin: 300000,
        marginRate: 0.285, missingCost: false },
      { articleId: 'a2', code: 'CIM-2', designation: 'Ciment 32,5', stockUnit: 'KG', quantitySold: 5,
        averageSalePrice: null, averagePurchasePrice: null, revenue: 0, cost: 0, margin: 0,
        marginRate: null, missingCost: true },
    ],
  }],
  transportBilled: 50000, cancelledRevenue: 0, cancelledCost: 0, transferLosses: 0, inventoryGains: 0,
  inventoryLosses: 0, revenue: 1050000, cost: 700000, margin: 350000, marginRate: 0.3333,
  expenses: {
    common: [{ categoryId: 'c1', label: 'Loyer', amount: 100000 }], commonTotal: 100000, commonInformative: false,
    byAgency: [{ agencyId: 'g1', label: 'Cotonou', categories: [{ categoryId: 'c2', label: 'Salaires', amount: 50000 }], total: 50000 }],
    total: 150000,
  },
  netProfit: 200000, missingCostArticles: [], salesWithMissingCost: 0,
  ...over,
});

describe('ProfitabilityComponent', () => {
  let httpTesting: HttpTestingController;
  const range = presetRange('month', new Date());

  function setup(data: ProfitabilityReport = report()) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProfitabilityComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou')]);
    httpTesting.expectOne(r => r.url === '/api/v1/reports/profitability').flush(data);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => httpTesting.verify());

  it('loads the current month for all agencies on init', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.createComponent(ProfitabilityComponent).detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([]);
    const req = httpTesting.expectOne(r => r.url === '/api/v1/reports/profitability');
    expect(req.request.params.get('from')).toBe(range.from);
    expect(req.request.params.get('to')).toBe(range.to);
    expect(req.request.params.has('agencyId')).toBe(false);
    req.flush(report());
  });

  it('expands a family to show its articles', () => {
    const { fixture, element } = setup();
    expect(element.textContent).toContain('Ciment');
    expect(element.textContent).not.toContain('CIM-1');

    (element.querySelector('.family-row') as HTMLElement).click();
    fixture.detectChanges();

    expect(element.textContent).toContain('CIM-1');
    expect(element.textContent).toContain('28,5 %');
    expect(element.textContent).toContain('coût manquant');
  });

  it('shows the missing cost banner', () => {
    const { fixture, element } = setup(report({
      salesWithMissingCost: 2,
      missingCostArticles: [{ articleId: 'a2', designation: 'Ciment 32,5', agencyId: 'g1', agencyLabel: 'Cotonou', quantity: 40 }],
    }));
    const banner = element.querySelector('.banner-warning') as HTMLElement;
    expect(banner).not.toBeNull();
    expect(banner.textContent).not.toContain('Cotonou');

    (banner.querySelector('button.link') as HTMLElement).click();
    fixture.detectChanges();
    expect(banner.textContent).toContain('Ciment 32,5 — Cotonou');
  });

  it('labels common expenses as informative in agency view', () => {
    const data = report();
    const { element } = setup(report({
      agencyId: 'g1', agencyLabel: 'Cotonou', expenses: { ...data.expenses, commonInformative: true },
    }));
    expect(element.textContent).toContain('Charges communes (pour information, non déduites)');
  });

  it('shows a negative net profit in red', () => {
    const { element } = setup(report({ netProfit: -50000 }));
    expect(element.querySelector('.net-profit')?.classList.contains('negative')).toBe(true);
  });

  it('shows a positive net profit in green', () => {
    const { element } = setup();
    expect(element.querySelector('.net-profit')?.classList.contains('negative')).toBe(false);
  });

  it('explains that the tracking is not started', () => {
    const { element } = setup(report({ beforeStart: true, trackingStartedAt: null }));
    const link = element.querySelector('a[href="/initial-costs"]');
    expect(link).not.toBeNull();
  });

  it('tells there is no data before the tracking start date', () => {
    const { element } = setup(report({ beforeStart: true, trackingStartedAt: '2026-10-05T08:00:00' }));
    expect(element.textContent).toContain('Pas de données avant le 05/10/2026');
  });

  it('reconciles each displayed column with the TOTAL row', () => {
    const { element } = setup(report({
      transportBilled: 50000, cancelledRevenue: 20000, cancelledCost: 12000, transferLosses: 5000,
      inventoryGains: 3000, inventoryLosses: 1000, revenue: 1030000, cost: 688000, margin: 339000,
    }));
    const num = (cell: Element) => Number(cell.textContent!.replace(/\u2212/g, '-').replace(/[^0-9-]/g, '') || 0);
    const sum = (selector: string, col: number) =>
      Array.from(element.querySelectorAll(selector)).reduce((t, row) => t + num(row.querySelectorAll('td')[col]), 0);
    const total = element.querySelector('tfoot .total-row')!;
    for (const col of [4, 5, 6]) {
      expect(sum('.family-row, .extra-row', col)).toBe(num(total.querySelectorAll('td')[col]));
    }
  });

  it('shows a zero cancellation as 0 and not -0', () => {
    const { element } = setup();
    expect(element.textContent).not.toMatch(/[-\u2212]0\s/);
    const row = Array.from(element.querySelectorAll('.extra-row')).find(r => r.textContent!.includes('Annulations'))!;
    expect(row.querySelectorAll('td')[4].textContent).toContain('0');
    expect(row.querySelectorAll('td')[4].textContent).not.toMatch(/[-\u2212]/);
  });

  it('downloads the xlsx with the current filters', () => {
    const { component } = setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    component.onAgencySelected({ id: 'g1', label: 'Cotonou' });
    httpTesting.expectOne(r => r.url === '/api/v1/reports/profitability').flush(report());

    component.exportReport('xlsx');
    const req = httpTesting.expectOne(r => r.url === '/api/v1/reports/profitability/xlsx');
    expect(req.request.params.get('from')).toBe(range.from);
    expect(req.request.params.get('to')).toBe(range.to);
    expect(req.request.params.get('agencyId')).toBe('g1');
    req.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="rentabilite.xlsx"' } });

    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('revokes the blob URL only after the click has been handled', () => {
    vi.useFakeTimers();
    try {
      const { component } = setup();
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      URL.createObjectURL = vi.fn(() => 'blob:x');
      URL.revokeObjectURL = vi.fn();

      component.exportReport('pdf');
      httpTesting.expectOne(r => r.url === '/api/v1/reports/profitability/pdf')
        .flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="r.pdf"' } });

      expect(click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
      click.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('warns when cost tracking started inside the period', () => {
    const { element } = setup(report({ from: '2026-10-01', trackingStartedAt: '2026-10-12T14:30:00' }));
    expect(element.querySelector('.partial-start')?.textContent?.trim()).toBe(
      'Marge calculée à partir du 12/10/2026 à 14:30 (démarrage du suivi des coûts) ; '
      + 'les dépenses couvrent toute la période.');
  });

  it('shows no partial-period notice when tracking started before the period', () => {
    expect(setup().element.querySelector('.partial-start')).toBeNull();
  });

  it('shows no partial-period notice when the period is before the start', () => {
    const { element } = setup(report({ trackingStartedAt: '2026-11-05T10:00:00', beforeStart: true }));
    expect(element.querySelector('.partial-start')).toBeNull();
  });
});
