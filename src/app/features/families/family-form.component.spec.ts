import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Family } from '../../core/models/family.model';
import { FamilyFormComponent } from './family-form.component';

const URL = '/api/v1/families';
const at = '2026-09-01T08:00:00';

const building: Family = {
  id: 'f1', label: 'Gros œuvre', displayOrder: 10, parentId: null, parentLabel: null, createdAt: at, updatedAt: at,
};
const cement: Family = {
  id: 'f2', label: 'Ciments et liants', displayOrder: 11, parentId: 'f1', parentLabel: 'Gros œuvre', createdAt: at, updatedAt: at,
};
const whiteCement: Family = {
  id: 'f3', label: 'Ciment blanc', displayOrder: 1, parentId: 'f2', parentLabel: 'Ciments et liants', createdAt: at, updatedAt: at,
};
const roofing: Family = {
  id: 'f4', label: 'Couverture', displayOrder: 20, parentId: null, parentLabel: null, createdAt: at, updatedAt: at,
};
const all = [building, cement, whiteCement, roofing];

describe('FamilyFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(family: Family | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(FamilyFormComponent);
    fixture.componentRef.setInput('family', family);
    fixture.componentRef.setInput('families', all);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('starts as a root family when creating', () => {
    const { component } = setup(null);

    expect(component.form.getRawValue()).toEqual({ label: '', displayOrder: 0, parentId: null });
    expect(component.parentOptions().map(o => o.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
  });

  it('is prefilled with the family being edited, parent label included', () => {
    const { component } = setup(cement);

    expect(component.form.getRawValue()).toEqual({ label: 'Ciments et liants', displayOrder: 11, parentId: 'f1' });
    expect(component.parentLabel()).toBe('Gros œuvre');
  });

  it('reloads when another family is selected without closing the panel', () => {
    const { fixture, component } = setup(cement);

    fixture.componentRef.setInput('family', roofing);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({ label: 'Couverture', displayOrder: 20, parentId: null });
    expect(component.parentLabel()).toBe('');
  });

  it('never offers the family itself or its descendants as parent', () => {
    const { component } = setup(cement);

    expect(component.parentOptions().map(o => o.id)).toEqual(['f1', 'f4']);
  });

  it('records the chosen parent, and clears it with the empty choice', () => {
    const { component } = setup(null);

    component.onParentSelected({ id: 'f4', label: 'Couverture' });
    expect(component.form.controls.parentId.value).toBe('f4');
    expect(component.parentLabel()).toBe('Couverture');

    component.onParentSelected(null);
    expect(component.form.controls.parentId.value).toBeNull();
    expect(component.parentLabel()).toBe('');
  });

  it('refuses a missing label, a label over 100 characters and a negative order', () => {
    const { component } = setup(null);

    expect(component.form.controls.label.hasError('required')).toBe(true);

    component.form.patchValue({ label: 'A'.repeat(101), displayOrder: -1 });

    expect(component.form.controls.label.hasError('maxlength')).toBe(true);
    expect(component.form.controls.displayOrder.hasError('min')).toBe(true);
  });

  it('does not call the backend when the form is invalid, and reveals the errors', () => {
    const { component, saved } = setup(null);

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.label.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('creates a child family and emits saved', () => {
    const { component, saved } = setup(null);
    component.form.patchValue({ label: 'Plomberie', displayOrder: 31 });
    component.onParentSelected({ id: 'f1', label: 'Gros œuvre' });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ label: 'Plomberie', displayOrder: 31, parentId: 'f1' });
    req.flush({ ...roofing, id: 'f9' });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('updates the edited family and emits saved', () => {
    const { component, saved } = setup(cement);
    component.onParentSelected(null);

    component.submit();

    const req = httpTesting.expectOne(`${URL}/f2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ label: 'Ciments et liants', displayOrder: 11, parentId: null });
    req.flush(cement);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend message and does not emit saved', () => {
    const { component, saved } = setup(null);
    component.form.patchValue({ label: 'Couverture', displayOrder: 1 });

    component.submit();

    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Une famille « Couverture » existe déjà à ce niveau', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.formError()).toBe('Une famille « Couverture » existe déjà à ce niveau');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
