import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { AgencyStock, StockMovement } from '../../core/models/stock.model';
import { StockDetailComponent } from './stock-detail.component';

const at = '2026-09-15T08:17:59.5';

const cement: AgencyStock = {
  id: 's1', articleId: 'a1', articleCode: 'CIM-32R', articleDesignation: 'Ciment CIM II 32.5R',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', stockUnitCode: 'KG',
  quantity: 120, reservedQuantity: 20, availableQuantity: 100, alertThreshold: 2000, belowThreshold: true, updatedAt: at,
};
const porto: AgencyStock = { ...cement, id: 's2', agencyId: 'g2', agencyLabel: 'Porto-Novo — Siège', quantity: 40, reservedQuantity: 0, availableQuantity: 40 };

const count: StockMovement = {
  id: 'm1', type: 'ADJUSTMENT', quantity: 120, resultingQuantity: 120, documentType: null, documentId: null,
  reason: 'Inventaire initial', movementDate: at, reversedMovementId: null, articleId: 'a1',
  articleDesignation: 'Ciment CIM II 32.5R', agencyId: 'g1', agencyLabel: 'Cotonou — Siège', userId: 'u1', userName: 'Administrateur',
};

const plain = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim();

describe('StockDetailComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(stock: AgencyStock, canAct = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(StockDetailComponent);
    fixture.componentRef.setInput('stock', stock);
    fixture.componentRef.setInput('canAct', canAct);
    fixture.detectChanges();

    const countRequested = vi.fn();
    fixture.componentInstance.count.subscribe(countRequested);

    const element = fixture.nativeElement as HTMLElement;
    const render = () => fixture.detectChanges();
    const value = (term: string) =>
      plain([...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)?.nextElementSibling?.textContent);
    const rows = (selector: string) =>
      [...element.querySelectorAll<HTMLTableRowElement>(`${selector} tbody tr`)].map(tr =>
        [...tr.cells].map(cell => plain(cell.textContent)).join(' | '),
      );

    return { fixture, element, render, value, rows, countRequested };
  }

  /** Both side lists are loaded when the sheet opens. */
  function flushSideLists(spread: AgencyStock[], movements: StockMovement[]) {
    httpTesting.expectOne('/api/v1/articles/a1/stock').flush(spread);
    const req = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements');
    expect(req.request.params.get('articleId')).toBe('a1');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ content: movements, totalElements: movements.length, totalPages: 1, number: 0, size: 10 });
  }

  afterEach(() => httpTesting.verify());

  it('shows the quantities in the stock unit and the alert', () => {
    const { value } = setup(cement);
    flushSideLists([], []);

    expect(value('Article')).toBe('CIM-32R — Ciment CIM II 32.5R');
    expect(value('Physique')).toBe('120 KG');
    expect(value('Réservé')).toBe('20 KG');
    expect(value('Disponible')).toBe('100 KG');
    expect(value('Seuil d’alerte')).toBe('2 000 KG');
    expect(value('État')).toBe('Sous le seuil');
  });

  it('shows the spread across agencies and the latest movements', () => {
    const { render, rows } = setup(cement);
    flushSideLists([cement, porto], [count]);
    render();

    expect(rows('.spread')).toEqual(['Cotonou — Siège | 100 KG', 'Porto-Novo — Siège | 40 KG']);
    expect(rows('.movements')).toEqual(['15/09/2026 08:17 | Inventaire | +120 KG | 120 KG | Administrateur | Inventaire initial']);
  });

  it('offers an inventory count only to users allowed to act on this agency', () => {
    const allowed = setup(cement, true);
    flushSideLists([], []);
    allowed.element.querySelector<HTMLButtonElement>('.actions button')!.click();
    expect(allowed.countRequested).toHaveBeenCalledTimes(1);

    TestBed.resetTestingModule();
    const readOnly = setup(cement, false);
    flushSideLists([], []);
    expect(readOnly.element.querySelector('.actions button')).toBeNull();
  });

  it('shows a loading error without hiding the quantities', () => {
    const { render, value, element } = setup(cement);
    httpTesting.expectOne('/api/v1/articles/a1/stock').flush(
      { status: 500, message: 'Erreur interne', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );
    httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements').flush(
      { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 },
    );
    render();

    expect(value('Physique')).toBe('120 KG');
    expect(element.textContent).toContain('Erreur interne');
  });
});
