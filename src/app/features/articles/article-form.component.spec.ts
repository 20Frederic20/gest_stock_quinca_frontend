import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Article } from '../../core/models/article.model';
import { Family } from '../../core/models/family.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { ArticleFormComponent } from './article-form.component';

const URL = '/api/v1/articles';
const at = '2026-09-13T11:32:32.423855';

const families: Family[] = [
  { id: 'f1', label: 'Matériaux de construction', displayOrder: 1, parentId: null, parentLabel: null, createdAt: at, updatedAt: at },
  { id: 'f2', label: 'Ciment et liants', displayOrder: 1, parentId: 'f1', parentLabel: 'Matériaux de construction', createdAt: at, updatedAt: at },
];
const units: UnitOfMeasure[] = [
  { id: 'u1', code: 'KG', label: 'Kilogramme', createdAt: at, updatedAt: at },
  { id: 'u2', code: 'SAC', label: 'Sac', createdAt: at, updatedAt: at },
];

const cement: Article = {
  id: 'a1', code: 'CIM-32R', barcode: '6181100234567', designation: 'Ciment CIM II 32.5R',
  alertThreshold: 2000, vatRate: 0.18, active: true,
  familyId: 'f2', familyLabel: 'Ciment et liants', stockUnitId: 'u1', stockUnitCode: 'KG',
  createdAt: at, updatedAt: at,
};

const valid = {
  code: 'FER-12', barcode: '', designation: 'Fer à béton 12 mm', alertThreshold: 50,
  vatRate: 18, familyId: 'f1', stockUnitId: 'u2',
};

describe('ArticleFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(article: Article | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ArticleFormComponent);
    fixture.componentRef.setInput('article', article);
    fixture.componentRef.setInput('families', families);
    fixture.componentRef.setInput('units', units);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts empty with an 18 % VAT when creating', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({
      code: '', barcode: '', designation: '', alertThreshold: 0, vatRate: 18, familyId: '', stockUnitId: '',
    });
    expect(component.form.valid).toBe(false);
  });

  it('is prefilled with the edited article, VAT shown as a percentage', () => {
    const { component } = setup(cement);

    expect(component.form.getRawValue()).toEqual({
      code: 'CIM-32R', barcode: '6181100234567', designation: 'Ciment CIM II 32.5R',
      alertThreshold: 2000, vatRate: 18, familyId: 'f2', stockUnitId: 'u1',
    });
    expect(component.familyLabel()).toBe('Ciment et liants');
    expect(component.unitLabel()).toBe('KG — Kilogramme');
  });

  it('reloads when another article is selected without closing the panel', () => {
    const { fixture, component } = setup(cement);

    fixture.componentRef.setInput('article', { ...cement, id: 'a2', code: 'CIM-42', vatRate: 0.07 });
    fixture.detectChanges();

    expect(component.form.controls.code.value).toBe('CIM-42');
    expect(component.form.controls.vatRate.value).toBe(7);
  });

  it('offers the families in tree order and the units with their code', () => {
    const { component } = setup(null);

    expect(component.familyOptions().map(o => o.label)).toEqual(['Matériaux de construction', 'Ciment et liants']);
    expect(component.unitOptions().map(o => o.label)).toEqual(['KG — Kilogramme', 'SAC — Sac']);
  });

  it('accepts a complete entry with an empty barcode', () => {
    const { component } = setup(null);

    component.form.setValue(valid);

    expect(component.form.valid).toBe(true);
  });

  it('applies the backend limits', () => {
    const { component } = setup(null);
    const { controls } = component.form;

    component.form.setValue({
      ...valid, code: 'A'.repeat(31), barcode: '1'.repeat(51), designation: 'A'.repeat(201),
      alertThreshold: -1, vatRate: 101,
    });

    expect(controls.code.hasError('maxlength')).toBe(true);
    expect(controls.barcode.hasError('maxlength')).toBe(true);
    expect(controls.designation.hasError('maxlength')).toBe(true);
    expect(controls.alertThreshold.hasError('min')).toBe(true);
    expect(controls.vatRate.hasError('max')).toBe(true);

    component.form.patchValue({ vatRate: -1 });
    expect(controls.vatRate.hasError('min')).toBe(true);
  });

  it('requires a family and a stock unit', () => {
    const { component } = setup(null);

    component.form.setValue({ ...valid, familyId: '', stockUnitId: '' });

    expect(component.form.controls.familyId.hasError('required')).toBe(true);
    expect(component.form.controls.stockUnitId.hasError('required')).toBe(true);
  });

  it('records the chosen family and unit', () => {
    const { component } = setup(null);

    component.onFamilySelected({ id: 'f1', label: 'Matériaux de construction' });
    component.onUnitSelected({ id: 'u2', label: 'SAC — Sac' });

    expect(component.form.controls.familyId.value).toBe('f1');
    expect(component.familyLabel()).toBe('Matériaux de construction');
    expect(component.form.controls.stockUnitId.value).toBe('u2');
    expect(component.unitLabel()).toBe('SAC — Sac');
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.familyId.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates an article, sending the VAT as a fraction and an empty barcode as null', () => {
    const { component, saved } = setup(null);
    component.form.setValue({ ...valid, barcode: '   ', vatRate: 7 });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ...valid, barcode: null, vatRate: 0.07 });
    req.flush(cement);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited article and emits saved', () => {
    const { component, saved } = setup(cement);
    component.form.controls.designation.setValue('Ciment CIM II 32.5R — sac 50 kg');

    component.submit();

    const req = httpTesting.expectOne(`${URL}/a1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      code: 'CIM-32R', barcode: '6181100234567', designation: 'Ciment CIM II 32.5R — sac 50 kg',
      alertThreshold: 2000, vatRate: 0.18, familyId: 'f2', stockUnitId: 'u1',
    });
    req.flush(cement);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('keeps the backend errors and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.setValue(valid);

    component.submit();

    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Un article avec le code FER-12 existe déjà', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toBe('Un article avec le code FER-12 existe déjà');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
