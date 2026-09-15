import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { AgencyListComponent } from './agency-list.component';

const URL = '/api/v1/agencies';
const at = '2026-09-14T19:00:00';

const headOffice: Agency = {
  id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null,
  active: true, createdAt: at, updatedAt: at,
};
const parakou: Agency = { ...headOffice, id: 'g2', code: 'PKO', label: 'Parakou' };

describe('AgencyListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(AgencyListComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => httpTesting.verify());

  it('loads every agency, inactive ones included, when the screen opens', () => {
    const component = setup();
    expect(component.loading()).toBe(true);

    httpTesting.expectOne(URL).flush([headOffice, { ...parakou, active: false }]);

    expect(component.agencies().map(a => a.id)).toEqual(['g1', 'g2']);
    expect(component.loading()).toBe(false);
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    httpTesting.expectOne(URL).flush(
      { status: 500, message: 'Erreur interne', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne');
  });

  it('opens the detail on a row, switches to the form, and cancelling goes back', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);

    component.openDetail(parakou);
    expect(component.drawerMode()).toBe('detail');

    component.openEdit();
    expect(component.drawerMode()).toBe('form');

    component.onFormCancelled();
    expect(component.drawerMode()).toBe('detail');
    expect(component.selectedAgency()).toBe(parakou);
  });

  it('closes the drawer and reloads after saving', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([headOffice]);
    component.openCreate();
    expect(component.selectedAgency()).toBeNull();

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne(URL).flush([headOffice, parakou]);
  });

  it('deactivates the agency and updates the sheet and the row', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);
    component.openDetail(parakou);

    component.toggleActive();

    const req = httpTesting.expectOne(`${URL}/g2/deactivate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...parakou, active: false });

    expect(component.selectedAgency()?.active).toBe(false);
    expect(component.agencies()[1].active).toBe(false);
  });

  it('activates an inactive agency', () => {
    const component = setup();
    const inactive = { ...parakou, active: false };
    httpTesting.expectOne(URL).flush([inactive]);
    component.openDetail(inactive);

    component.toggleActive();

    httpTesting.expectOne(`${URL}/g2/activate`).flush(parakou);
    expect(component.selectedAgency()?.active).toBe(true);
  });

  it('keeps the list visible when an action fails', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([parakou]);
    component.openDetail(parakou);

    component.toggleActive();
    httpTesting.expectOne(`${URL}/g2/deactivate`).flush(
      { status: 404, message: 'Agence introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.actionError()).toBe('Agence introuvable');
    expect(component.error()).toBeNull();
  });

  it('deletes only after confirmation, then closes and reloads', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);
    component.openDetail(parakou);

    component.askDelete();
    httpTesting.expectNone(`${URL}/g2`);
    expect(component.deleteMessage()).toContain('Parakou');

    component.confirmDelete();
    const req = httpTesting.expectOne(`${URL}/g2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne(URL).flush([headOffice]);
  });

  it('does nothing when deletion is cancelled', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([parakou]);
    component.openDetail(parakou);

    component.askDelete();
    component.cancelDelete();

    httpTesting.expectNone(`${URL}/g2`);
    expect(component.agencyToDelete()).toBeNull();
  });
});
