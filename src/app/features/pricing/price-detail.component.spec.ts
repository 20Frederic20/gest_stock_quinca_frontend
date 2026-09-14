import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ArticlePrice } from '../../core/models/article-price.model';
import { PriceDetailComponent } from './price-detail.component';

const at = '2026-09-13T11:29:08.779306';
const TODAY = '2026-09-14';
const HISTORY = '/api/packagings/k1/prices/history';

const base: ArticlePrice = {
  id: 'x2', packagingId: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R',
  packagingUnitCode: 'SAC', packagingQuantity: 50, privilegeId: 'p1', privilegeLabel: 'Détail',
  unitPrice: 4800, startDate: '2026-06-01', effective: true, createdAt: at, updatedAt: at,
};
const december: ArticlePrice = { ...base, id: 'x3', unitPrice: 5000, startDate: '2026-12-01', effective: false };
const june = base;
const january: ArticlePrice = { ...base, id: 'x1', unitPrice: 4500, startDate: '2026-01-01' };

describe('PriceDetailComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(price: ArticlePrice) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PriceDetailComponent);
    fixture.componentRef.setInput('price', price);
    fixture.componentRef.setInput('today', TODAY);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const outputs = { edit: vi.fn(), delete: vi.fn() };
    component.edit.subscribe(outputs.edit);
    component.delete.subscribe(outputs.delete);

    const element = fixture.nativeElement as HTMLElement;
    const render = () => fixture.detectChanges();
    const value = (term: string) =>
      [...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)
        ?.nextElementSibling?.textContent?.trim().replace(/\s+/g, ' ');
    const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('.actions button')];
    const flushHistory = (prices: ArticlePrice[]) => {
      const req = httpTesting.expectOne(r => r.url === HISTORY);
      expect(req.request.params.get('privilegeId')).toBe('p1');
      req.flush(prices);
      render();
    };

    return { fixture, component, element, outputs, value, buttons, flushHistory };
  }

  afterEach(() => httpTesting.verify());

  it('shows the price and loads its history for the same privilege', () => {
    const { value, element, flushHistory } = setup(june);

    expect(value('Grille')).toBe('Détail');
    expect(value('Conditionnement')).toBe('SAC — Ciment CIM II 32.5R');
    expect(value('Prix unitaire')).toBe('4 800 F CFA');
    expect(value('À partir du')).toBe('01/06/2026');

    flushHistory([december, june, january]);

    expect(value('Statut')).toBe('En vigueur');
    // Cell by cell: Angular drops the whitespace between the <td> tags.
    const rows = [...element.querySelectorAll<HTMLTableRowElement>('.history tbody tr')].map(tr =>
      [...tr.cells].map(cell => cell.textContent?.trim().replace(/\s+/g, ' ')).join(' '),
    );
    expect(rows).toEqual([
      '01/12/2026 5 000 F CFA À venir',
      '01/06/2026 4 800 F CFA En vigueur',
      '01/01/2026 4 500 F CFA Remplacé',
    ]);
  });

  it('reloads the history when another price is shown', () => {
    const { fixture, flushHistory } = setup(june);
    flushHistory([june]);

    fixture.componentRef.setInput('price', { ...june, id: 'y1', privilegeId: 'p1' });
    fixture.detectChanges();

    flushHistory([june]);
  });

  it('only lets a scheduled price be edited or deleted', () => {
    const scheduledCase = setup(december);
    scheduledCase.flushHistory([december, june]);

    expect(scheduledCase.buttons().map(b => b.textContent?.trim())).toEqual(['Modifier', 'Supprimer']);
    scheduledCase.buttons()[0].click();
    scheduledCase.buttons()[1].click();
    expect(scheduledCase.outputs.edit).toHaveBeenCalledTimes(1);
    expect(scheduledCase.outputs.delete).toHaveBeenCalledTimes(1);
  });

  it('explains why a started price is locked', () => {
    TestBed.resetTestingModule();
    const { buttons, element, flushHistory } = setup(june);
    flushHistory([december, june]);

    expect(buttons()).toEqual([]);
    expect(element.querySelector('.locked')?.textContent).toContain('créez un nouveau prix');
  });

  it('shows the history error without hiding the price', () => {
    const { fixture, value, element } = setup(june);

    httpTesting.expectOne(r => r.url === HISTORY).flush(
      { status: 404, message: 'Privilège introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(value('Prix unitaire')).toBe('4 800 F CFA');
    expect(element.textContent).toContain('Privilège introuvable');
  });
});
