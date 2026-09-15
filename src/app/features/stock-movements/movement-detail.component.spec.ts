import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { StockMovement } from '../../core/models/stock.model';
import { MovementDetailComponent } from './movement-detail.component';

const count: StockMovement = {
  id: 'm1', type: 'ADJUSTMENT', quantity: 8400, resultingQuantity: 8400, documentType: null, documentId: null,
  reason: 'Inventaire de fin du mois', movementDate: '2026-09-15T08:27:11.2', reversedMovementId: null,
  articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
  userId: 'u1', userName: 'Administrateur',
};
const reversal: StockMovement = {
  ...count, id: 'm2', type: 'REVERSAL', quantity: -8400, resultingQuantity: 0, reason: 'Saisie en double',
  reversedMovementId: 'm1', movementDate: '2026-09-15T09:02:00',
};

const plain = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim();

describe('MovementDetailComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(movement: StockMovement, options: { canReverse?: boolean; alreadyReversed?: boolean } = {}) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(MovementDetailComponent);
    fixture.componentRef.setInput('movement', movement);
    fixture.componentRef.setInput('canReverse', options.canReverse ?? true);
    fixture.componentRef.setInput('alreadyReversed', options.alreadyReversed ?? false);
    fixture.detectChanges();

    const reverseRequested = vi.fn();
    fixture.componentInstance.reverse.subscribe(reverseRequested);

    const element = fixture.nativeElement as HTMLElement;
    const render = () => fixture.detectChanges();
    const value = (term: string) =>
      plain([...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)?.nextElementSibling?.textContent);
    const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('.actions button')];

    return { element, render, value, buttons, reverseRequested };
  }

  /** The movement has no unit: it is read on the article. */
  function flushUnit(unit = 'KG') {
    httpTesting.expectOne('/api/v1/articles/a1').flush({ id: 'a1', stockUnitCode: unit });
  }

  afterEach(() => httpTesting.verify());

  it('shows every field, the quantities in the article stock unit', () => {
    const { render, value } = setup(count);
    flushUnit();
    render();

    expect(value('Date')).toBe('15/09/2026 08:27');
    expect(value('Type')).toBe('Inventaire');
    expect(value('Article')).toBe('Ciment CIM II 32.5R');
    expect(value('Agence')).toBe('Cotonou — Siège');
    expect(value('Quantité')).toBe('+8 400 KG');
    expect(value('Stock après')).toBe('8 400 KG');
    expect(value('Par')).toBe('Administrateur');
    expect(value('Motif')).toBe('Inventaire de fin du mois');
    expect(value('Pièce')).toBe('—');
  });

  it('offers to cancel a movement, and emits the request', () => {
    const { buttons, reverseRequested } = setup(count);
    flushUnit();

    expect(buttons().map(b => b.textContent?.trim())).toEqual(['Annuler ce mouvement']);
    buttons()[0].click();
    expect(reverseRequested).toHaveBeenCalledTimes(1);
  });

  it('never offers to cancel a reversal, and says what it cancels', () => {
    const { render, buttons, element } = setup(reversal);
    flushUnit();
    render();

    expect(buttons()).toEqual([]);
    expect(element.querySelector('.note')?.textContent).toContain('annule un mouvement précédent');
  });

  it('does not offer to cancel a movement already cancelled', () => {
    const { buttons, element } = setup(count, { alreadyReversed: true });
    flushUnit();

    expect(buttons()).toEqual([]);
    expect(element.querySelector('.note')?.textContent).toContain('déjà été annulé');
  });

  it('does not offer to cancel without the right to act on this agency', () => {
    const { buttons } = setup(count, { canReverse: false });
    flushUnit();

    expect(buttons()).toEqual([]);
  });

  it('shows the quantities without unit when the article cannot be read', () => {
    const { render, value } = setup(count);
    httpTesting.expectOne('/api/v1/articles/a1').flush(null, { status: 404, statusText: 'Not Found' });
    render();

    expect(value('Quantité')).toBe('+8 400');
  });
});
