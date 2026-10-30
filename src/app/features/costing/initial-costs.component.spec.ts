import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { CostingStatus, InitialCostLine } from '../../core/models/costing.model';
import { Packaging } from '../../core/models/packaging.model';
import { InitialCostsComponent } from './initial-costs.component';

const at = '2026-09-16T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});
const line = (lotId: string, unitCost: number | null): InitialCostLine => ({
  lotId, articleId: 'a' + lotId, articleCode: 'CIM-' + lotId, designation: 'Ciment ' + lotId, familyLabel: 'Ciment',
  stockUnit: 'KG', agencyId: 'g1', agencyLabel: 'Cotonou', quantity: 120, unitCost,
});
const sack = (articleId: string, defaultPurchase = true): Packaging => ({
  id: 'p-' + articleId, articleId, articleDesignation: 'Ciment', unitId: 'u1', unitCode: 'SAC', unitLabel: 'Sac',
  quantity: 50, defaultPurchase, defaultSale: false, createdAt: at, updatedAt: at,
});
const notStarted: CostingStatus = { started: false, startedAt: null, startedByName: null, missingCostCount: 0 };
const started: CostingStatus = {
  started: true, startedAt: '2026-10-30T09:05:00', startedByName: 'Awa', missingCostCount: 1,
};

describe('InitialCostsComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(status: CostingStatus) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(InitialCostsComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou')]);
    httpTesting.expectOne('/api/v1/costing/status').flush(status);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => httpTesting.verify());

  it('asks for confirmation before starting the tracking', () => {
    const { component, fixture, element } = setup(notStarted);
    expect(element.textContent).toContain('Démarrer le suivi des coûts');

    component.askStart();
    expect(component.confirmingStart()).toBe(true);
    httpTesting.expectNone('/api/v1/costing/start');

    component.confirmStart();
    const req = httpTesting.expectOne('/api/v1/costing/start');
    expect(req.request.method).toBe('POST');
    req.flush(started);
    httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots').flush([line('1', null)]);
    flushPackagings();
    fixture.detectChanges();

    expect(element.textContent).toContain('Suivi démarré le 30/10/2026 à 09:05 par Awa');
  });

  it('filters lines without cost by default and shows the progress counter', () => {
    const { component, fixture, element } = setup(started);
    const req = httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots');
    flushLots(req, [line('1', null), line('2', 500), line('3', 800)]);
    fixture.detectChanges();

    expect(component.missingOnly()).toBe(true);
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.querySelector('.progress')?.textContent).toContain('2 / 3 articles renseignés · 1 manquant');

    component.missingOnly.set(false);
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('saves the cost of one line', () => {
    const { component, fixture, element } = setup(started);
    flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', null)]);
    fixture.detectChanges();

    component.saveCost(component.lines()[0], '1250');
    const req = httpTesting.expectOne('/api/v1/costing/initial-lots/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ unitCost: 1250 });
    req.flush(line('1', 1250));
    fixture.detectChanges();

    expect(component.lines()[0].unitCost).toBe(1250);
    expect(element.querySelector('tbody tr .state-ok')).not.toBeNull();
  });

  it('refuses a negative or empty cost without calling the backend', () => {
    const { component } = setup(started);
    flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', null)]);

    component.saveCost(component.lines()[0], '-3');
    expect(component.rowErrors()['1']).toBeTruthy();
  });

  describe('packaging of the cost', () => {
    function row(element: HTMLElement) {
      return {
        select: element.querySelector('tbody tr select.unit-select') as HTMLSelectElement,
        input: element.querySelector('tbody tr .cost-input') as HTMLInputElement,
      };
    }
    function type(input: HTMLInputElement, value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    }

    it('selects the default purchase packaging and lists the base unit too', () => {
      const { fixture, element } = setup(started);
      flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', null)], {
        a1: [sack('a1')],
      });
      fixture.detectChanges();

      const { select } = row(element);
      expect(Array.from(select.options).map(o => o.textContent?.trim().replace(/\s/g, ' '))).toEqual(['Sac de 50 KG', 'KG']);
      expect(select.selectedOptions[0].textContent?.trim().replace(/\s/g, ' ')).toBe('Sac de 50 KG');
    });

    it('selects the base unit when no packaging is the default purchase one', () => {
      const { fixture, element } = setup(started);
      flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', null)], {
        a1: [sack('a1', false)],
      });
      fixture.detectChanges();

      expect(row(element).select.selectedOptions[0].textContent?.trim()).toBe('KG');
    });

    it('saves the price typed for the sack as a cost per stock unit', () => {
      const { fixture, element } = setup(started);
      flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', null)], {
        a1: [sack('a1')],
      });
      fixture.detectChanges();

      type(row(element).input, '4000');
      fixture.detectChanges();
      expect(element.querySelector('.conversion')?.textContent?.replace(/\s/g, ' ')).toContain('= 80 F CFA par KG');

      const req = httpTesting.expectOne('/api/v1/costing/initial-lots/1');
      expect(req.request.body).toEqual({ unitCost: 80 });
      req.flush(line('1', 80));
    });

    it('shows a stored cost per sack, or per KG when KG is selected, without saving', () => {
      const { fixture, element } = setup(started);
      flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', 80)], {
        a1: [sack('a1')],
      });
      fixture.componentInstance.toggleMissingOnly({ target: { checked: false } } as unknown as Event);
      fixture.detectChanges();
      flushPackagings({ a1: [sack('a1')] });
      fixture.detectChanges();

      const { select, input } = row(element);
      expect(input.value).toBe('4000');

      select.value = Array.from(select.options).find(o => o.textContent?.trim() === 'KG')!.value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(row(element).input.value).toBe('80');
      httpTesting.expectNone('/api/v1/costing/initial-lots/1');
    });

    it('falls back to the base unit when the packagings cannot be loaded, and still saves', () => {
      const { fixture, element } = setup(started);
      httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots').flush([line('1', null)]);
      httpTesting.expectOne('/api/v1/articles/a1/packagings').flush(
        { status: 500, message: 'Erreur', fieldErrors: null },
        { status: 500, statusText: 'Server Error' },
      );
      fixture.detectChanges();

      const { select, input } = row(element);
      expect(Array.from(select.options).map(o => o.textContent?.trim())).toEqual(['KG']);
      expect(fixture.componentInstance.error()).toBeNull();

      type(input, '80');
      const req = httpTesting.expectOne('/api/v1/costing/initial-lots/1');
      expect(req.request.body).toEqual({ unitCost: 80 });
      req.flush(line('1', 80));
    });

    it('loads the packagings of an article exactly once, even for several lines or when lines are shown again', () => {
      const { fixture, component } = setup(started);
      const lots = [line('1', null), line('2', null), { ...line('3', null), articleId: 'a1' }];
      httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots').flush(lots);
      const requests = httpTesting.match(r => r.url.endsWith('/packagings'));
      expect(requests.map(r => r.request.url).sort()).toEqual([
        '/api/v1/articles/a1/packagings',
        '/api/v1/articles/a2/packagings',
      ]);
      requests.forEach(r => r.flush([]));

      component.toggleMissingOnly({ target: { checked: false } } as unknown as Event);
      component.toggleMissingOnly({ target: { checked: true } } as unknown as Event);
      fixture.detectChanges();
      httpTesting.expectNone(r => r.url.endsWith('/packagings'));
    });

    it('keeps the meaning of an unsaved price when the packaging changes', () => {
      const { fixture, element } = setup(started);
      flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', 80)], {});
      fixture.componentInstance.toggleMissingOnly({ target: { checked: false } } as unknown as Event);
      fixture.detectChanges();
      flushPackagings({ a1: [sack('a1')] });
      fixture.detectChanges();

      const { select, input } = row(element);
      expect(input.value).toBe('4000');
      input.value = '4500';
      input.dispatchEvent(new Event('input'));
      select.value = Array.from(select.options).find(o => o.textContent?.trim() === 'KG')!.value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(row(element).input.value).toBe('90');
      httpTesting.expectNone('/api/v1/costing/initial-lots/1');
    });

    it('keeps the cost input disabled until the packagings are known, then applies the default one', () => {
      const { fixture, element } = setup(started);
      httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots').flush([line('1', null)]);
      fixture.detectChanges();
      expect(row(element).input.disabled).toBe(true);
      expect(row(element).select.disabled).toBe(true);

      httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([sack('a1')]);
      fixture.detectChanges();
      expect(row(element).input.disabled).toBe(false);
      expect(row(element).select.disabled).toBe(false);
      expect(row(element).select.selectedOptions[0].textContent?.trim()).toBe('Sac de 50 KG');
    });

    it('shows a per-unit cost with its cents in the conversion', () => {
      const { fixture, element } = setup(started);
      flushLots(httpTesting.expectOne(r => r.url === '/api/v1/costing/initial-lots'), [line('1', null)]);
      fixture.detectChanges();

      type(row(element).input, '80.5');
      fixture.detectChanges();
      expect(element.querySelector('.conversion')?.textContent?.replace(/\s/g, ' ')).toContain('80,5');
      httpTesting.expectOne('/api/v1/costing/initial-lots/1').flush(line('1', 80.5));
    });
  });

  /** Answers the lots request, then the lazy packagings request of each displayed article. */
  function flushLots(
    req: ReturnType<HttpTestingController['expectOne']>,
    lines: InitialCostLine[],
    packagings: Record<string, Packaging[]> = {},
  ) {
    expect(req.request.params.get('missingOnly')).toBe('false');
    req.flush(lines);
    flushPackagings(packagings);
  }

  function flushPackagings(packagings: Record<string, Packaging[]> = {}) {
    for (const request of httpTesting.match(r => r.url.endsWith('/packagings'))) {
      const articleId = request.request.url.split('/')[4];
      request.flush(packagings[articleId] ?? []);
    }
  }
});
