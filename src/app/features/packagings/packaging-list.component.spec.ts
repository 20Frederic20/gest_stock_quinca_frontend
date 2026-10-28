import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Article } from '../../core/models/article.model';
import { Packaging } from '../../core/models/packaging.model';
import { PackagingListComponent } from './packaging-list.component';

const at = '2026-09-13T11:32:32.423855';

const cement: Article = {
  id: 'a1', code: 'CIM-32R', barcode: null, designation: 'Ciment CIM II 32.5R',
  alertThreshold: 2000, vatRate: 0.18, active: true,
  familyId: 'f2', familyLabel: 'Ciment et liants', stockUnitId: 'u1', stockUnitCode: 'KG',
  createdAt: at, updatedAt: at,
};
const bag: Packaging = {
  id: 'p1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R',
  unitId: 'u2', unitCode: 'SAC', unitLabel: 'Sac', quantity: 50,
  defaultPurchase: false, defaultSale: true, createdAt: at, updatedAt: at,
};
const pallet: Packaging = {
  ...bag, id: 'p2', unitId: 'u3', unitCode: 'PAL', unitLabel: 'Palette', quantity: 1400,
  defaultPurchase: true, defaultSale: false,
};

const cementOption = { id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' };

describe('PackagingListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PackagingListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/units-of-measure').flush([]);

    return fixture.componentInstance;
  }

  /** Selects the cement and answers both requests: its packagings and the article itself. */
  function selectCement(component: PackagingListComponent, packagings: Packaging[]) {
    component.onArticleSelected(cementOption);
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush(packagings);
    httpTesting.expectOne('/api/v1/articles/a1').flush(cement);
  }

  afterEach(() => httpTesting.verify());

  it('loads nothing until an article is chosen', () => {
    const component = setup();

    expect(component.selectedArticle()).toBeNull();
    expect(component.packagings()).toEqual([]);
  });

  it('loads the packagings and the stock unit of the chosen article', () => {
    const component = setup();

    component.onArticleSelected(cementOption);
    expect(component.loading()).toBe(true);
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([bag, pallet]);
    httpTesting.expectOne('/api/v1/articles/a1').flush(cement);

    expect(component.packagings()).toEqual([bag, pallet]);
    expect(component.stockUnitCode()).toBe('KG');
    expect(component.loading()).toBe(false);
  });

  it('ignores the answers for an article that is no longer selected', () => {
    const component = setup();

    component.onArticleSelected(cementOption);
    const oldPackagings = httpTesting.expectOne('/api/v1/articles/a1/packagings');
    const oldArticle = httpTesting.expectOne('/api/v1/articles/a1');
    component.onArticleSelected({ id: 'a2', label: 'FER-8 — Fer à béton' });

    expect(oldPackagings.cancelled).toBe(true);
    expect(oldArticle.cancelled).toBe(true);
    httpTesting.expectOne('/api/v1/articles/a2/packagings').flush([]);
    httpTesting.expectOne('/api/v1/articles/a2').flush({ ...cement, id: 'a2', stockUnitCode: 'U' });
    expect(component.stockUnitCode()).toBe('U');
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    component.onArticleSelected(cementOption);
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush(
      { status: 404, message: 'Article introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );
    httpTesting.expectOne('/api/v1/articles/a1').flush(cement);

    expect(component.error()).toBe('Article introuvable');
    expect(component.loading()).toBe(false);
  });

  it('cannot create a packaging before an article is chosen', () => {
    const component = setup();

    component.openCreate();

    expect(component.drawerOpen()).toBe(false);
  });

  it('opens the detail on a row, switches to the form, and cancelling goes back', () => {
    const component = setup();
    selectCement(component, [bag, pallet]);

    component.openDetail(pallet);
    expect(component.drawerMode()).toBe('detail');

    component.openEdit();
    expect(component.drawerMode()).toBe('form');

    component.onFormCancelled();
    expect(component.drawerMode()).toBe('detail');
    expect(component.selectedPackaging()).toBe(pallet);
  });

  it('closes the drawer and reloads after saving', () => {
    const component = setup();
    selectCement(component, [bag]);
    component.openCreate();
    expect(component.drawerMode()).toBe('form');

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([bag, pallet]);
    expect(component.packagings()).toEqual([bag, pallet]);
  });

  it('sets the default for sales, keeps the sheet open and reloads, since another flag may have moved', () => {
    const component = setup();
    selectCement(component, [bag, pallet]);
    component.openDetail(pallet);

    component.setDefaultSale();

    const req = httpTesting.expectOne('/api/v1/packagings/p2/default-sale');
    expect(req.request.method).toBe('PATCH');
    const updated = { ...pallet, defaultSale: true };
    req.flush(updated);

    expect(component.drawerOpen()).toBe(true);
    expect(component.selectedPackaging()).toEqual(updated);
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([{ ...bag, defaultSale: false }, updated]);
    expect(component.packagings().map(p => p.defaultSale)).toEqual([false, true]);
  });

  it('sets the default for purchases', () => {
    const component = setup();
    selectCement(component, [bag, pallet]);
    component.openDetail(bag);

    component.setDefaultPurchase();

    httpTesting.expectOne('/api/v1/packagings/p1/default-purchase').flush({ ...bag, defaultPurchase: true });
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([]);
    expect(component.selectedPackaging()?.defaultPurchase).toBe(true);
  });

  it('keeps the list visible when an action fails', () => {
    const component = setup();
    selectCement(component, [bag]);
    component.openDetail(bag);

    component.setDefaultPurchase();
    httpTesting.expectOne('/api/v1/packagings/p1/default-purchase').flush(
      { status: 404, message: 'Conditionnement introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.actionError()).toBe('Conditionnement introuvable');
    expect(component.error()).toBeNull();
    expect(component.packagings()).toEqual([bag]);
  });

  it('deletes only after confirmation, then closes the drawer and reloads', () => {
    const component = setup();
    selectCement(component, [bag, pallet]);
    component.openDetail(bag);

    component.askDelete();
    httpTesting.expectNone('/api/v1/packagings/p1');
    expect(component.deleteMessage()).toContain('SAC de 50 KG');

    component.confirmDelete();
    const req = httpTesting.expectOne('/api/v1/packagings/p1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.drawerOpen()).toBe(false);
    expect(component.packagingToDelete()).toBeNull();
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([pallet]);
    expect(component.packagings()).toEqual([pallet]);
  });

  it('does nothing when deletion is cancelled', () => {
    const component = setup();
    selectCement(component, [bag]);
    component.openDetail(bag);

    component.askDelete();
    component.cancelDelete();

    httpTesting.expectNone('/api/v1/packagings/p1');
    expect(component.packagingToDelete()).toBeNull();
  });
});
