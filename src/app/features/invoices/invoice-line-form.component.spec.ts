import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Article } from '../../core/models/article.model';
import { PendingLine } from '../../core/models/invoice.model';
import { Packaging } from '../../core/models/packaging.model';
import { AgencyStock } from '../../core/models/stock.model';
import { InvoiceLineFormComponent } from './invoice-line-form.component';

const at = '2026-09-15T08:00:00';
const bag: Packaging = {
  id: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R', unitId: 'u2', unitCode: 'SAC', unitLabel: 'Sac',
  quantity: 50, defaultPurchase: false, defaultSale: true, createdAt: at, updatedAt: at,
};
const kilo: Packaging = { ...bag, id: 'k2', unitCode: 'KG', unitLabel: 'Kilogramme', quantity: 1, defaultSale: false };
const stock = {
  articleId: 'a1', stockUnitCode: 'KG', quantity: 1000, reservedQuantity: 0, availableQuantity: 1000,
} as AgencyStock;
const cement = {
  id: 'a1', code: 'CIM-32R', designation: 'Ciment CIM II 32.5R', vatRate: 0.18, stockUnitCode: 'KG',
} as Article;

describe('InvoiceLineFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(checkStock = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoiceLineFormComponent);
    fixture.componentRef.setInput('privilegeId', 'p1');
    fixture.componentRef.setInput('agencyId', 'g1');
    fixture.componentRef.setInput('checkStock', checkStock);
    fixture.detectChanges();

    const composed = vi.fn();
    fixture.componentInstance.composed.subscribe(composed);

    return { component: fixture.componentInstance, composed };
  }

  /** Picks the cement: packagings and stock answer, then the price of the default sale packaging. */
  function chooseCement(component: InvoiceLineFormComponent, unitPrice: number | null = 5000) {
    component.onArticleSelected({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([bag, kilo]);
    httpTesting.expectOne('/api/v1/articles/a1').flush(cement);
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush(stock);

    const price = httpTesting.expectOne(r => r.url === '/api/v1/packagings/k1/prices/applicable');
    expect(price.request.params.get('privilegeId')).toBe('p1');
    if (unitPrice === null) {
      price.flush(
        { status: 404, message: 'Aucun prix en vigueur pour cette grille', fieldErrors: null },
        { status: 404, statusText: 'Not Found' },
      );
    } else {
      price.flush({ unitPrice });
    }
  }

  afterEach(() => httpTesting.verify());

  it('picks the default sale packaging and shows its price in the customer’s grid', () => {
    const { component } = setup();

    chooseCement(component);

    expect(component.packaging()).toEqual(bag);
    expect(component.packagingLabel(bag)).toBe('Sac de 50 KG');
    expect(component.unitPrice()).toBe(5000);
    expect(component.available()).toBe(1000);
    expect(component.canAdd()).toBe(true);
  });

  it('asks the price again when another packaging is chosen', () => {
    const { component } = setup();
    chooseCement(component);

    component.onPackagingSelected({ id: 'k2', label: 'Kilogramme de 1 KG' });

    httpTesting.expectOne(r => r.url === '/api/v1/packagings/k2/prices/applicable').flush({ unitPrice: 110 });
    expect(component.unitPrice()).toBe(110);
  });

  it('estimates the line and warns when the stock is short', () => {
    const { component } = setup();
    chooseCement(component);

    component.form.setValue({ quantity: 30, discountRate: 10 });

    expect(component.estimate()).toBe(135000);
    expect(component.needed()).toBe(1500);
    expect(component.shortage()).toBe(true);
  });

  it('does not worry about stock for a quote or a proforma', () => {
    const { component } = setup(false);
    chooseCement(component);

    component.form.setValue({ quantity: 30, discountRate: 0 });

    expect(component.shortage()).toBe(false);
  });

  it('treats an article that never moved in the agency as unavailable', () => {
    const { component } = setup();

    component.onArticleSelected({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([]);
    httpTesting.expectOne('/api/v1/articles/a1').flush(cement);
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush(
      { status: 404, message: 'Stock introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.available()).toBe(0);
    expect(component.priceMessage()).toContain('aucun conditionnement');
    expect(component.canAdd()).toBe(false);
  });

  it('cannot add a line without a price', () => {
    const { component } = setup();

    chooseCement(component, null);

    expect(component.priceMessage()).toBe('Aucun prix en vigueur pour cette grille');
    expect(component.canAdd()).toBe(false);
  });

  it('hands the composed line over and gets ready for the next article', () => {
    const { component, composed } = setup();
    chooseCement(component);
    component.form.setValue({ quantity: 2, discountRate: 0 });

    component.submit();

    // Nothing is sent: the line is saved by whoever asked for it, at the moment it chooses.
    httpTesting.expectNone(request => request.method === 'POST');
    const line: PendingLine = {
      articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
      unitLabel: 'Sac', appliedCoefficient: 50, quantity: 2, discountRate: 0, unitPrice: 5000, vatRate: 0.18,
    };
    expect(composed).toHaveBeenCalledWith(line);
    expect(component.article()).toBeNull();
    expect(component.packaging()).toBeNull();
    expect(component.form.getRawValue()).toEqual({ quantity: 1, discountRate: 0 });
  });

  it('refuses an invalid quantity instead of composing a line', () => {
    const { component, composed } = setup();
    chooseCement(component);
    component.form.setValue({ quantity: 0, discountRate: 0 });

    component.submit();

    expect(component.formError()).toContain('quantité');
    expect(composed).not.toHaveBeenCalled();
  });
});
