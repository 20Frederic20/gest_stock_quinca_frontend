import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Packaging } from '../../core/models/packaging.model';
import { PurchaseOrderLineFormComponent } from './purchase-order-line-form.component';

const at = '2026-09-16T08:00:00';
const bag: Packaging = {
  id: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R', unitId: 'u2', unitCode: 'SAC',
  unitLabel: 'Sac', quantity: 50, defaultPurchase: true, defaultSale: false, createdAt: at, updatedAt: at,
};
const kilo: Packaging = { ...bag, id: 'k2', unitCode: 'KG', unitLabel: 'Kilogramme', quantity: 1, defaultPurchase: false };

describe('PurchaseOrderLineFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PurchaseOrderLineFormComponent);
    fixture.detectChanges();

    const composed = vi.fn();
    fixture.componentInstance.composed.subscribe(composed);

    return { component: fixture.componentInstance, composed };
  }

  /** Picks the cement: its packagings answer, and the one bought by default is preselected. */
  function chooseCement(component: PurchaseOrderLineFormComponent) {
    component.onArticleSelected({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([kilo, bag]);
  }

  afterEach(() => httpTesting.verify());

  it('picks the packaging the article is usually bought in', () => {
    const { component } = setup();

    chooseCement(component);

    expect(component.packaging()).toEqual(bag);
    expect(component.packagingLabel(bag)).toBe('Sac de 50');
    expect(component.canAdd()).toBe(true);
  });

  it('says so when the article has no packaging to buy', () => {
    const { component } = setup();

    component.onArticleSelected({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([]);

    expect(component.formError()).toContain('aucun conditionnement');
    expect(component.canAdd()).toBe(false);
  });

  it('hands the line over and gets ready for the next article', () => {
    const { component, composed } = setup();
    chooseCement(component);
    component.form.setValue({ quantity: 20, unitPrice: 4200 });

    component.submit();

    expect(composed).toHaveBeenCalledWith({ packagingId: 'k1', quantity: 20, unitPrice: 4200 });
    expect(component.article()).toBeNull();
    expect(component.packaging()).toBeNull();
    expect(component.form.getRawValue()).toEqual({ quantity: 1, unitPrice: 0 });
  });

  it('refuses a quantity that is not strictly positive', () => {
    const { component, composed } = setup();
    chooseCement(component);
    component.form.setValue({ quantity: 0, unitPrice: 4200 });

    component.submit();

    expect(composed).not.toHaveBeenCalled();
    expect(component.formError()).toContain('quantité');
  });

  it('accepts a price of zero: a free sample is bought at nothing', () => {
    const { component, composed } = setup();
    chooseCement(component);
    component.form.setValue({ quantity: 5, unitPrice: 0 });

    component.submit();

    expect(composed).toHaveBeenCalledWith({ packagingId: 'k1', quantity: 5, unitPrice: 0 });
  });
});
