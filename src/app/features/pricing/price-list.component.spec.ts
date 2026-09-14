import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Article } from '../../core/models/article.model';
import { ArticlePrice } from '../../core/models/article-price.model';
import { Packaging } from '../../core/models/packaging.model';
import { Privilege } from '../../core/models/privilege.model';
import { PriceListComponent } from './price-list.component';

const at = '2026-09-13T11:32:32.423855';

const cement: Article = {
  id: 'a1', code: 'CIM-32R', barcode: null, designation: 'Ciment CIM II 32.5R',
  alertThreshold: 2000, vatRate: 0.18, active: true,
  familyId: 'f2', familyLabel: 'Ciment et liants', stockUnitId: 'u1', stockUnitCode: 'KG',
  createdAt: at, updatedAt: at,
};
const bag: Packaging = {
  id: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R',
  unitId: 'u2', unitCode: 'SAC', unitLabel: 'Sac', quantity: 50,
  defaultPurchase: false, defaultSale: true, createdAt: at, updatedAt: at,
};
const pallet: Packaging = { ...bag, id: 'k2', unitId: 'u3', unitCode: 'PAL', unitLabel: 'Palette', quantity: 1400 };
const privileges: Privilege[] = [
  { id: 'p1', label: 'Détail', isDefault: true, createdAt: at, updatedAt: at },
  { id: 'p2', label: 'Chantier', isDefault: false, createdAt: at, updatedAt: at },
];

// Dates far from today, so that the statuses do not depend on when the tests run.
const price = (id: string, privilegeId: string, privilegeLabel: string, startDate: string, unitPrice: number): ArticlePrice => ({
  id, packagingId: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R',
  packagingUnitCode: 'SAC', packagingQuantity: 50, privilegeId, privilegeLabel, unitPrice, startDate,
  effective: startDate < '2050-01-01', createdAt: at, updatedAt: at,
});
const retailOld = price('x1', 'p1', 'Détail', '2000-01-01', 4500);
const retailCurrent = price('x2', 'p1', 'Détail', '2001-01-01', 4800);
const retailNext = price('x3', 'p1', 'Détail', '2099-01-01', 5000);
const siteCurrent = price('x4', 'p2', 'Chantier', '2001-01-01', 4400);

const cementOption = { id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' };

describe('PriceListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PriceListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/privileges').flush(privileges);

    return fixture.componentInstance;
  }

  function selectCement(component: PriceListComponent, packagings: Packaging[]) {
    component.onArticleSelected(cementOption);
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush(packagings);
    httpTesting.expectOne('/api/v1/articles/a1').flush(cement);
  }

  function selectBag(component: PriceListComponent, prices: ArticlePrice[]) {
    selectCement(component, [bag, pallet]);
    component.onPackagingSelected({ id: 'k1', label: '' });
    httpTesting.expectOne('/api/packagings/k1/prices').flush(prices);
  }

  afterEach(() => httpTesting.verify());

  it('offers the packagings of the chosen article, described with the stock unit', () => {
    const component = setup();

    selectCement(component, [bag, pallet]);

    // Normalised: Intl groups thousands with a narrow no-break space.
    expect(component.packagingOptions().map(o => ({ ...o, label: o.label.replace(/\s+/g, ' ') }))).toEqual([
      { id: 'k1', label: 'SAC de 50 KG' },
      { id: 'k2', label: 'PAL de 1 400 KG' },
    ]);
    expect(component.selectedPackaging()).toBeNull();
  });

  it('picks the packaging at once when the article has only one', () => {
    const component = setup();

    selectCement(component, [bag]);

    expect(component.selectedPackaging()).toBe(bag);
    httpTesting.expectOne('/api/packagings/k1/prices').flush([]);
  });

  it('loads the prices of the chosen packaging, grouped by privilege with their status', () => {
    const component = setup();

    selectBag(component, [retailNext, retailCurrent, siteCurrent, retailOld]);

    expect(component.rows().map(r => [r.price.id, r.status])).toEqual([
      ['x4', 'current'],
      ['x3', 'scheduled'],
      ['x2', 'current'],
      ['x1', 'past'],
    ]);
  });

  it('forgets the packaging and its prices when another article is chosen', () => {
    const component = setup();
    selectBag(component, [retailCurrent]);

    component.onArticleSelected({ id: 'a2', label: 'FER-8 — Fer à béton' });

    expect(component.selectedPackaging()).toBeNull();
    expect(component.prices()).toEqual([]);
    httpTesting.expectOne('/api/v1/articles/a2/packagings').flush([]);
    httpTesting.expectOne('/api/v1/articles/a2').flush({ ...cement, id: 'a2' });
  });

  it('ignores the prices of a packaging that is no longer selected', () => {
    const component = setup();
    selectCement(component, [bag, pallet]);

    component.onPackagingSelected({ id: 'k1', label: '' });
    const old = httpTesting.expectOne('/api/packagings/k1/prices');
    component.onPackagingSelected({ id: 'k2', label: '' });

    expect(old.cancelled).toBe(true);
    httpTesting.expectOne('/api/packagings/k2/prices').flush([]);
  });

  it('shows the error message when the prices cannot be loaded', () => {
    const component = setup();
    selectCement(component, [bag, pallet]);

    component.onPackagingSelected({ id: 'k1', label: '' });
    httpTesting.expectOne('/api/packagings/k1/prices').flush(
      { status: 404, message: 'Conditionnement introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.error()).toBe('Conditionnement introuvable');
    expect(component.loading()).toBe(false);
  });

  it('cannot create a price before a packaging is chosen', () => {
    const component = setup();
    selectCement(component, [bag, pallet]);

    component.openCreate();

    expect(component.drawerOpen()).toBe(false);
  });

  it('opens the detail, switches to the form, and cancelling goes back', () => {
    const component = setup();
    selectBag(component, [retailNext, retailCurrent]);

    component.openDetail(retailNext);
    expect(component.drawerMode()).toBe('detail');

    component.openEdit();
    expect(component.drawerMode()).toBe('form');

    component.onFormCancelled();
    expect(component.drawerMode()).toBe('detail');
    expect(component.selectedPrice()).toBe(retailNext);
  });

  it('closes the drawer and reloads after saving', () => {
    const component = setup();
    selectBag(component, [retailCurrent]);
    component.openCreate();
    expect(component.drawerMode()).toBe('form');

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne('/api/packagings/k1/prices').flush([retailNext, retailCurrent]);
    expect(component.prices()).toEqual([retailNext, retailCurrent]);
  });

  it('deletes a scheduled price only after confirmation, then reloads', () => {
    const component = setup();
    selectBag(component, [retailNext, retailCurrent]);
    component.openDetail(retailNext);

    component.askDelete();
    httpTesting.expectNone('/api/prices/x3');
    expect(component.deleteMessage().replace(/\s+/g, ' ')).toContain('5 000 F CFA');
    expect(component.deleteMessage()).toContain('Détail');

    component.confirmDelete();
    const req = httpTesting.expectOne('/api/prices/x3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne('/api/packagings/k1/prices').flush([retailCurrent]);
    expect(component.prices()).toEqual([retailCurrent]);
  });

  it('keeps the list visible when deletion fails', () => {
    const component = setup();
    selectBag(component, [retailNext]);
    component.openDetail(retailNext);

    component.askDelete();
    component.confirmDelete();
    httpTesting.expectOne('/api/prices/x3').flush(
      { status: 400, message: 'Impossible de supprimer un prix déjà en vigueur', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toBe('Impossible de supprimer un prix déjà en vigueur');
    expect(component.error()).toBeNull();
    expect(component.prices()).toEqual([retailNext]);
  });
});
