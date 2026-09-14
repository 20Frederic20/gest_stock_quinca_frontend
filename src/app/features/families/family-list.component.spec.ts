import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Family } from '../../core/models/family.model';
import { FamilyListComponent } from './family-list.component';

const URL = '/api/v1/families';
const at = '2026-09-01T08:00:00';

const building: Family = {
  id: 'f1', label: 'Gros œuvre', displayOrder: 10, parentId: null, parentLabel: null, createdAt: at, updatedAt: at,
};
const cement: Family = {
  id: 'f2', label: 'Ciments et liants', displayOrder: 11, parentId: 'f1', parentLabel: 'Gros œuvre', createdAt: at, updatedAt: at,
};

describe('FamilyListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(FamilyListComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => httpTesting.verify());

  it('loads the families and orders them as a tree', () => {
    const component = setup();
    expect(component.loading()).toBe(true);

    httpTesting.expectOne(URL).flush([cement, building]);

    expect(component.rows().map(r => [r.family.id, r.depth])).toEqual([['f1', 0], ['f2', 1]]);
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

  it('opens the drawer on the selected family', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([building, cement]);

    component.openEdit(cement);

    expect(component.drawerOpen()).toBe(true);
    expect(component.selectedFamily()).toBe(cement);
  });

  it('closes the drawer and reloads the list after saving', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([building]);
    component.openCreate();

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne(URL).flush([building, cement]);
    expect(component.families()).toEqual([building, cement]);
  });

  it('deletes a family only after confirmation, then reloads the list', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([building, cement]);

    component.askDelete(cement, new Event('click'));
    httpTesting.expectNone(`${URL}/f2`);
    expect(component.familyToDelete()).toBe(cement);

    component.confirmDelete();

    const req = httpTesting.expectOne(`${URL}/f2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    httpTesting.expectOne(URL).flush([building]);
    expect(component.families()).toEqual([building]);
    expect(component.familyToDelete()).toBeNull();
  });

  it('does nothing when deletion is cancelled', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([building]);

    component.askDelete(building, new Event('click'));
    component.cancelDelete();

    httpTesting.expectNone(`${URL}/f1`);
    expect(component.familyToDelete()).toBeNull();
  });

  it('keeps the list visible and shows the reason when deletion fails', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([building, cement]);

    component.askDelete(building, new Event('click'));
    component.confirmDelete();
    httpTesting.expectOne(`${URL}/f1`).flush(
      { status: 400, message: 'Impossible de supprimer la famille « Gros œuvre » : elle contient des sous-familles', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toContain('elle contient des sous-familles');
    expect(component.error()).toBeNull();
    expect(component.families()).toEqual([building, cement]);
    expect(component.familyToDelete()).toBeNull();
  });
});
