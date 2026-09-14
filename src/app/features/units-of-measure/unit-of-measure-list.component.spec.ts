import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { UnitOfMeasureListComponent } from './unit-of-measure-list.component';

const URL = '/api/v1/units-of-measure';

const bag: UnitOfMeasure = {
  id: 'u1', code: 'SAC', label: 'Sac', createdAt: '2026-09-01T08:00:00', updatedAt: '2026-09-01T08:00:00',
};
const kilogram: UnitOfMeasure = {
  id: 'u2', code: 'KG', label: 'Kilogramme', createdAt: '2026-09-01T08:00:00', updatedAt: '2026-09-01T08:00:00',
};

describe('UnitOfMeasureListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(UnitOfMeasureListComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => httpTesting.verify());

  it('loads the units when the screen opens', () => {
    const component = setup();
    expect(component.loading()).toBe(true);

    httpTesting.expectOne(URL).flush([bag, kilogram]);

    expect(component.units()).toEqual([bag, kilogram]);
    expect(component.loading()).toBe(false);
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    httpTesting.expectOne(URL).flush(
      { status: 500, message: 'Erreur interne', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne');
    expect(component.loading()).toBe(false);
  });

  it('opens the drawer on the selected unit', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([bag, kilogram]);

    component.openEdit(bag);

    expect(component.drawerOpen()).toBe(true);
    expect(component.selectedUnit()).toBe(bag);
  });

  it('closes the drawer and reloads the list after saving', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([bag]);
    component.openCreate();

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne(URL).flush([bag, kilogram]);
    expect(component.units()).toEqual([bag, kilogram]);
  });

  it('deletes a unit only after confirmation, then reloads the list', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([bag, kilogram]);

    component.askDelete(bag, new Event('click'));
    httpTesting.expectNone(`${URL}/u1`);
    expect(component.unitToDelete()).toBe(bag);

    component.confirmDelete();

    const req = httpTesting.expectOne(`${URL}/u1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    httpTesting.expectOne(URL).flush([kilogram]);
    expect(component.units()).toEqual([kilogram]);
    expect(component.unitToDelete()).toBeNull();
  });

  it('does nothing when deletion is cancelled', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([bag]);

    component.askDelete(bag, new Event('click'));
    component.cancelDelete();

    httpTesting.expectNone(`${URL}/u1`);
    expect(component.unitToDelete()).toBeNull();
  });

  it('keeps the list visible and shows the reason when deletion fails', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([bag]);

    component.askDelete(bag, new Event('click'));
    component.confirmDelete();
    httpTesting.expectOne(`${URL}/u1`).flush(
      { status: 400, message: 'Cette unité est utilisée par des articles', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toBe('Cette unité est utilisée par des articles');
    expect(component.error()).toBeNull();
    expect(component.units()).toEqual([bag]);
    expect(component.unitToDelete()).toBeNull();
  });
});
