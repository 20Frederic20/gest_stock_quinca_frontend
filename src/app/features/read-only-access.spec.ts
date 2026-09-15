import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../core/auth/permissions';
import { errorInterceptor } from '../core/http/error.interceptor';
import { Agency } from '../core/models/agency.model';
import { Article } from '../core/models/article.model';
import { ArticlePrice } from '../core/models/article-price.model';
import { Family } from '../core/models/family.model';
import { Packaging } from '../core/models/packaging.model';
import { Privilege } from '../core/models/privilege.model';
import { UnitOfMeasure } from '../core/models/unit-of-measure.model';
import { Role } from '../core/models/user.model';
import { AgencyListComponent } from './agencies/agency-list.component';
import { ArticleListComponent } from './articles/article-list.component';
import { FamilyListComponent } from './families/family-list.component';
import { PackagingListComponent } from './packagings/packaging-list.component';
import { PriceListComponent } from './pricing/price-list.component';
import { PrivilegeListComponent } from './pricing/privilege-list.component';
import { UnitOfMeasureListComponent } from './units-of-measure/unit-of-measure-list.component';

/**
 * What the backend refuses must not be offered: users who may only read see no write action.
 * One case per screen; the backend enforces the same rules (see the API contract).
 */

const at = '2026-09-13T11:32:32.423855';
const unit: UnitOfMeasure = { id: 'u1', code: 'KG', label: 'Kilogramme', createdAt: at, updatedAt: at };
const family: Family = { id: 'f1', label: 'Peinture', displayOrder: 1, parentId: null, parentLabel: null, createdAt: at, updatedAt: at };
const article: Article = {
  id: 'a1', code: 'CIM-32R', barcode: null, designation: 'Ciment CIM II 32.5R', alertThreshold: 2000, vatRate: 0.18,
  active: true, familyId: 'f1', familyLabel: 'Peinture', stockUnitId: 'u1', stockUnitCode: 'KG', createdAt: at, updatedAt: at,
};
const packaging: Packaging = {
  id: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R', unitId: 'u2', unitCode: 'SAC', unitLabel: 'Sac',
  quantity: 50, defaultPurchase: false, defaultSale: true, createdAt: at, updatedAt: at,
};
const privilege: Privilege = { id: 'p1', label: 'Détail', isDefault: false, createdAt: at, updatedAt: at };
const scheduledPrice: ArticlePrice = {
  id: 'x1', packagingId: 'k1', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R', packagingUnitCode: 'SAC',
  packagingQuantity: 50, privilegeId: 'p1', privilegeLabel: 'Détail', unitPrice: 5000, startDate: '2099-01-01',
  effective: false, createdAt: at, updatedAt: at,
};
const agency: Agency = {
  id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null,
  active: true, createdAt: at, updatedAt: at,
};

describe('read-only access', () => {
  let httpTesting: HttpTestingController;

  function render<T>(component: Type<T>, role: Role, permissionsEnabled = true) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: permissionsEnabled },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u9', name: 'Lecteur', username: 'lecteur', role, agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });

    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const buttons = (selector: string) => [...element.querySelectorAll(selector)].map(b => b.textContent?.trim());

    return { fixture, component: fixture.componentInstance, element, refresh, buttons };
  }

  afterEach(() => httpTesting.verify());

  it('units of measure: no creation, no deletion, no form on a row', () => {
    const { component, element, refresh, buttons } = render(UnitOfMeasureListComponent, 'SELLER');
    httpTesting.expectOne('/api/v1/units-of-measure').flush([unit]);
    refresh();

    expect(buttons('app-page-header button')).toEqual([]);
    expect(buttons('tbody button')).toEqual([]);
    element.querySelector<HTMLElement>('tbody tr')!.click();
    expect(component.drawerOpen()).toBe(false);
  });

  it('families: no creation, no deletion, no form on a row', () => {
    const { component, element, refresh, buttons } = render(FamilyListComponent, 'CASHIER');
    httpTesting.expectOne('/api/v1/families').flush([family]);
    refresh();

    expect(buttons('app-page-header button')).toEqual([]);
    expect(buttons('tbody button')).toEqual([]);
    element.querySelector<HTMLElement>('tbody tr')!.click();
    expect(component.drawerOpen()).toBe(false);
  });

  it('articles: no creation, and a sheet without actions', () => {
    const { component, element, refresh, buttons } = render(ArticleListComponent, 'SELLER');
    httpTesting.expectOne('/api/v1/families').flush([]);
    httpTesting.expectOne('/api/v1/units-of-measure').flush([]);
    httpTesting.expectOne(r => r.url === '/api/v1/articles').flush({ content: [article], totalElements: 1, totalPages: 1, number: 0, size: 20 });
    refresh();

    expect(buttons('app-page-header button')).toEqual([]);
    component.openDetail(article);
    refresh();
    expect(element.querySelector('aside dl')).not.toBeNull();
    expect(buttons('aside .actions button')).toEqual([]);
  });

  it('packagings: no creation, and a sheet without actions', () => {
    const { component, element, refresh, buttons } = render(PackagingListComponent, 'SELLER');
    httpTesting.expectOne('/api/v1/units-of-measure').flush([]);
    component.onArticleSelected({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([packaging]);
    httpTesting.expectOne('/api/v1/articles/a1').flush(article);
    refresh();

    expect(buttons('app-page-header button')).toEqual([]);
    component.openDetail(packaging);
    refresh();
    expect(element.querySelector('aside dl')).not.toBeNull();
    expect(buttons('aside .actions button')).toEqual([]);
  });

  it('privileges: no creation, no row action, no form on a row', () => {
    const { fixture, element, refresh, buttons } = render(PrivilegeListComponent, 'SELLER');
    httpTesting.expectOne('/api/v1/privileges').flush([privilege]);
    refresh();

    expect(buttons('.section-header button')).toEqual([]);
    expect(buttons('tbody button')).toEqual([]);
    element.querySelector<HTMLElement>('tbody tr')!.click();
    expect(fixture.componentInstance.drawerOpen()).toBe(false);
  });

  it('prices: no creation, and not even a scheduled price can be edited', () => {
    const { component, element, refresh, buttons } = render(PriceListComponent, 'CASHIER');
    httpTesting.expectOne('/api/v1/privileges').flush([privilege]);
    component.onArticleSelected({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    httpTesting.expectOne('/api/v1/articles/a1/packagings').flush([packaging]);
    httpTesting.expectOne('/api/v1/articles/a1').flush(article);
    httpTesting.expectOne('/api/v1/packagings/k1/prices').flush([scheduledPrice]);
    refresh();

    expect(buttons('.section-header button')).toEqual([]);
    component.openDetail(scheduledPrice);
    refresh();
    httpTesting.expectOne(r => r.url === '/api/v1/packagings/k1/prices/history').flush([scheduledPrice]);
    refresh();
    expect(element.querySelector('aside dl')).not.toBeNull();
    expect(buttons('aside .actions button')).toEqual([]);
  });

  it('agencies: even a manager only reads them', () => {
    const { component, element, refresh, buttons } = render(AgencyListComponent, 'MANAGER');
    httpTesting.expectOne('/api/v1/agencies').flush([agency]);
    refresh();

    expect(buttons('app-page-header button')).toEqual([]);
    component.openDetail(agency);
    refresh();
    expect(element.querySelector('aside dl')).not.toBeNull();
    expect(buttons('aside .actions button')).toEqual([]);
  });

  it('shows every action to a seller while permissions are disabled', () => {
    const { refresh, buttons } = render(UnitOfMeasureListComponent, 'SELLER', false);
    httpTesting.expectOne('/api/v1/units-of-measure').flush([unit]);
    refresh();

    expect(buttons('app-page-header button')).toEqual(['Nouvelle unité']);
    expect(buttons('tbody button')).toEqual(['Supprimer']);
  });

  it('a manager keeps every referential action', () => {
    const { refresh, buttons } = render(UnitOfMeasureListComponent, 'MANAGER');
    httpTesting.expectOne('/api/v1/units-of-measure').flush([unit]);
    refresh();

    expect(buttons('app-page-header button')).toEqual(['Nouvelle unité']);
    expect(buttons('tbody button')).toEqual(['Supprimer']);
  });
});
