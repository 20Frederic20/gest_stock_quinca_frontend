import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { AgencyStock } from '../../core/models/stock.model';
import { InventoryFormComponent } from './inventory-form.component';

const at = '2026-09-15T08:00:00';
const ADJUST = '/api/v1/agencies/g1/stock/adjustments';

const cement: AgencyStock = {
  id: 's1', articleId: 'a1', articleCode: 'CIM-32R', articleDesignation: 'Ciment CIM II 32.5R',
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', stockUnitCode: 'KG',
  quantity: 120, reservedQuantity: 20, availableQuantity: 100, alertThreshold: 2000, belowThreshold: true, updatedAt: at,
};

const plain = (text: string | null) => text?.replace(/\s/g, ' ');

describe('InventoryFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(stock: AgencyStock | null, tracking: boolean | 'status-fails' = false) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InventoryFormComponent);
    fixture.componentRef.setInput('agencyId', 'g1');
    fixture.componentRef.setInput('stock', stock);
    fixture.detectChanges();
    const status = httpTesting.expectOne('/api/v1/costing/status');
    if (tracking === 'status-fails') {
      status.flush({ status: 500, message: 'Erreur', fieldErrors: null }, { status: 500, statusText: 'Server Error' });
    } else {
      status.flush({ started: tracking, startedAt: null, startedByName: null, missingCostCount: 0 });
    }
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => httpTesting.verify());

  it('starts on the given stock line, nothing counted yet', () => {
    const { component } = setup(cement);

    expect(component.form.getRawValue()).toEqual({ articleId: 'a1', countedQuantity: null, reason: '' });
    expect(component.articleLabel()).toBe('CIM-32R — Ciment CIM II 32.5R');
    expect(component.currentQuantity()).toBe(120);
    expect(component.difference()).toBeNull();
  });

  it('shows the difference with the current stock while typing', () => {
    const { component } = setup(cement);

    component.form.controls.countedQuantity.setValue(132);
    expect(component.difference()).toBe(12);
    expect(plain(component.differenceLabel())).toBe('+12 KG');

    component.form.controls.countedQuantity.setValue(117);
    expect(plain(component.differenceLabel())).toBe('−3 KG');
  });

  it('requires an article, a counted quantity of at least 0 and a reason', () => {
    const { component } = setup(null);
    const { controls } = component.form;

    component.form.setValue({ articleId: '', countedQuantity: -1, reason: '' });
    expect(controls.articleId.hasError('required')).toBe(true);
    expect(controls.countedQuantity.hasError('min')).toBe(true);
    expect(controls.reason.hasError('required')).toBe(true);

    controls.reason.setValue('A'.repeat(256));
    expect(controls.reason.hasError('maxlength')).toBe(true);
  });

  it('looks up the current stock of an article chosen by search', () => {
    const { component } = setup(null);

    component.onArticleSelected({ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' });
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a1').flush(cement);

    expect(component.form.controls.articleId.value).toBe('a1');
    expect(component.currentQuantity()).toBe(120);
    expect(component.unitCode()).toBe('KG');
  });

  it('counts from zero an article that has never been in this agency', () => {
    const { component } = setup(null);

    component.onArticleSelected({ id: 'a9', label: 'FER-8 — Fer à béton' });
    httpTesting.expectOne('/api/v1/agencies/g1/stock/a9').flush(
      { status: 404, message: 'Aucun stock enregistré pour cet article dans cette agence', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );
    // No stock line to give the unit: it is read on the article itself.
    httpTesting.expectOne('/api/v1/articles/a9').flush({ id: 'a9', code: 'FER-8', stockUnitCode: 'KG' });
    component.form.controls.countedQuantity.setValue(50);

    expect(component.currentQuantity()).toBe(0);
    expect(component.unitCode()).toBe('KG');
    expect(component.difference()).toBe(50);
    expect(plain(component.differenceLabel())).toBe('+50 KG');
  });

  it('does not call the backend while the form is invalid', () => {
    const { component, saved } = setup(cement);

    component.submit();

    httpTesting.expectNone(ADJUST);
    expect(component.form.controls.countedQuantity.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('records the count with a trimmed reason, then emits saved', () => {
    const { component, saved } = setup(cement);
    component.form.patchValue({ countedQuantity: 132, reason: '  Inventaire de septembre ' });

    component.submit();

    const req = httpTesting.expectOne(ADJUST);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ articleId: 'a1', countedQuantity: 132, reason: 'Inventaire de septembre' });
    req.flush({});
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend refusal and does not emit saved', () => {
    const { component, saved } = setup(cement);
    component.form.patchValue({ countedQuantity: 120, reason: 'Contrôle' });

    component.submit();
    httpTesting.expectOne(ADJUST).flush(
      { status: 400, message: 'La quantité comptée est identique au stock actuel : aucun ajustement nécessaire', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('identique au stock actuel');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });

  describe('unit cost of added stock', () => {
    const LAST_COST = '/api/v1/agencies/g1/costing/articles/a1/last-cost';

    it('requires a unit cost when the counted quantity is above the stock and tracking is on', () => {
      const { component, fixture, element } = setup(cement, true);
      component.form.patchValue({ countedQuantity: 132, reason: 'Inventaire' });
      httpTesting.expectOne(LAST_COST).flush({ unitCost: null });
      fixture.detectChanges();

      expect(element.querySelector('#unitCost')).not.toBeNull();
      expect(element.textContent).toContain('Coût unitaire des 12');

      component.submit();
      httpTesting.expectNone(ADJUST);
      expect(component.unitCost.touched).toBe(true);

      component.unitCost.setValue(900);
      component.submit();
      const req = httpTesting.expectOne(ADJUST);
      expect(req.request.body).toEqual({ articleId: 'a1', countedQuantity: 132, reason: 'Inventaire', unitCost: 900 });
      req.flush({});
    });

    it('prefills the unit cost with the last known cost', () => {
      const { component } = setup(cement, true);
      component.form.patchValue({ countedQuantity: 130 });
      httpTesting.expectOne(LAST_COST).flush({ unitCost: 750 });

      expect(component.unitCost.value).toBe(750);
    });

    it('does not show the unit cost for a decrease', () => {
      const { component, fixture, element } = setup(cement, true);
      component.form.patchValue({ countedQuantity: 100, reason: 'Casse' });
      fixture.detectChanges();

      expect(element.querySelector('#unitCost')).toBeNull();
      component.submit();
      const req = httpTesting.expectOne(ADJUST);
      expect(req.request.body).toEqual({ articleId: 'a1', countedQuantity: 100, reason: 'Casse' });
      req.flush({});
    });

    it('asks for the unit cost when the status call failed and the backend requires it', () => {
      const { component, fixture, element, saved } = setup(cement, 'status-fails');
      component.form.patchValue({ countedQuantity: 132, reason: 'Inventaire' });
      fixture.detectChanges();
      expect(element.querySelector('#unitCost')).toBeNull();

      component.submit();
      httpTesting.expectOne(ADJUST).flush(
        { status: 400, message: 'Le coût unitaire est obligatoire quand on ajoute du stock', fieldErrors: null },
        { status: 400, statusText: 'Bad Request' },
      );
      httpTesting.expectOne(LAST_COST).flush({ unitCost: null });
      fixture.detectChanges();

      expect(saved).not.toHaveBeenCalled();
      expect(element.querySelector('#unitCost')).not.toBeNull();
      component.submit();
      httpTesting.expectNone(ADJUST);

      component.unitCost.setValue(900);
      component.submit();
      const req = httpTesting.expectOne(ADJUST);
      expect(req.request.body).toEqual({ articleId: 'a1', countedQuantity: 132, reason: 'Inventaire', unitCost: 900 });
      req.flush({});
      expect(saved).toHaveBeenCalledTimes(1);
    });

    it('does not show the unit cost when tracking is off', () => {
      const { component, fixture, element } = setup(cement, false);
      component.form.patchValue({ countedQuantity: 150 });
      fixture.detectChanges();

      expect(element.querySelector('#unitCost')).toBeNull();
    });
  });
});
