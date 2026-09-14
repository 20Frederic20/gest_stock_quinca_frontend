import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Privilege } from '../../core/models/privilege.model';
import { PrivilegeListComponent } from './privilege-list.component';

const URL = '/api/v1/privileges';
const at = '2026-09-13T11:29:08.779306';

const retail: Privilege = { id: 'p1', label: 'Détail', isDefault: true, createdAt: at, updatedAt: at };
const site: Privilege = { id: 'p2', label: 'Chantier', isDefault: false, createdAt: at, updatedAt: at };

describe('PrivilegeListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PrivilegeListComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => httpTesting.verify());

  it('loads the privileges when the screen opens', () => {
    const { component } = setup();
    expect(component.loading()).toBe(true);

    httpTesting.expectOne(URL).flush([site, retail]);

    expect(component.privileges()).toEqual([site, retail]);
    expect(component.loading()).toBe(false);
  });

  it('shows the error message when loading fails', () => {
    const { component } = setup();

    httpTesting.expectOne(URL).flush(
      { status: 500, message: 'Erreur interne', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne');
  });

  it('offers to set as default and to delete only the privileges that are not the default', () => {
    const { fixture, element } = setup();
    httpTesting.expectOne(URL).flush([site, retail]);
    fixture.detectChanges();

    const rows = [...element.querySelectorAll('tbody tr')];
    const buttons = (row: Element) =>
      [...row.querySelectorAll<HTMLButtonElement>('button')].map(b => ({ label: b.textContent?.trim(), disabled: b.disabled }));

    expect(buttons(rows[0])).toEqual([
      { label: 'Définir par défaut', disabled: false },
      { label: 'Supprimer', disabled: false },
    ]);
    expect(rows[1].textContent).toContain('Par défaut');
    expect(buttons(rows[1])).toEqual([{ label: 'Supprimer', disabled: true }]);
  });

  it('opens the form on the selected privilege, and closes it and reloads after saving', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush([site, retail]);

    component.openEdit(site);
    expect(component.drawerOpen()).toBe(true);
    expect(component.selectedPrivilege()).toBe(site);

    component.onSaved();
    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne(URL).flush([site, retail]);
  });

  it('opens an empty form to create a privilege', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush([]);

    component.openCreate();

    expect(component.drawerOpen()).toBe(true);
    expect(component.selectedPrivilege()).toBeNull();
  });

  it('sets a privilege as the default without opening the form, then reloads', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush([site, retail]);

    component.setDefault(site, new Event('click'));

    const req = httpTesting.expectOne(`${URL}/p2/default`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...site, isDefault: true });
    expect(component.drawerOpen()).toBe(false);

    httpTesting.expectOne(URL).flush([{ ...site, isDefault: true }, { ...retail, isDefault: false }]);
    expect(component.privileges().map(p => p.isDefault)).toEqual([true, false]);
  });

  it('keeps the list visible when an action fails', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush([site, retail]);

    component.setDefault(site, new Event('click'));
    httpTesting.expectOne(`${URL}/p2/default`).flush(
      { status: 404, message: 'Privilège introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.actionError()).toBe('Privilège introuvable');
    expect(component.error()).toBeNull();
    expect(component.privileges()).toEqual([site, retail]);
  });

  it('deletes a privilege only after confirmation, then reloads', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush([site, retail]);

    component.askDelete(site, new Event('click'));
    httpTesting.expectNone(`${URL}/p2`);
    expect(component.deleteMessage()).toContain('Chantier');

    component.confirmDelete();
    const req = httpTesting.expectOne(`${URL}/p2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.privilegeToDelete()).toBeNull();
    httpTesting.expectOne(URL).flush([retail]);
    expect(component.privileges()).toEqual([retail]);
  });

  it('does nothing when deletion is cancelled', () => {
    const { component } = setup();
    httpTesting.expectOne(URL).flush([site]);

    component.askDelete(site, new Event('click'));
    component.cancelDelete();

    httpTesting.expectNone(`${URL}/p2`);
    expect(component.privilegeToDelete()).toBeNull();
  });
});
