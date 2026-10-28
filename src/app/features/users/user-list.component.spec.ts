import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { User } from '../../core/models/user.model';
import { UserListComponent } from './user-list.component';

const URL = '/api/v1/users';
const at = '2026-09-15T08:00:00';

const agency: Agency = {
  id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
};
const admin: User = {
  id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'ADMIN', discountLimit: 100, active: true,
  agencyId: 'g1', agencyLabel: 'Cotonou — Siège', createdAt: at, updatedAt: at,
};
const seller: User = { ...admin, id: 'u2', name: 'Koffi Mensah', username: 'koffi.mensah', role: 'SELLER', discountLimit: 5 };

describe('UserListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'ADMIN', agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });

    const fixture = TestBed.createComponent(UserListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency]);

    return fixture.componentInstance;
  }

  afterEach(() => httpTesting.verify());

  it('loads the users and the active agencies when the screen opens', () => {
    const component = setup();
    expect(component.loading()).toBe(true);

    httpTesting.expectOne(URL).flush([admin, seller]);

    expect(component.users()).toEqual([admin, seller]);
    expect(component.agencies()).toEqual([agency]);
    expect(component.loading()).toBe(false);
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    httpTesting.expectOne(URL).flush(
      { status: 403, message: 'Vous n’avez pas les droits pour cette action', fieldErrors: null },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(component.error()).toBe('Vous n’avez pas les droits pour cette action');
  });

  it('knows which row is the logged-in administrator', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([admin, seller]);

    expect(component.isSelf(admin)).toBe(true);
    expect(component.isSelf(seller)).toBe(false);
  });

  it('opens the detail, then the form or the password reset, and cancelling goes back', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([admin, seller]);

    component.openDetail(seller);
    expect(component.drawerMode()).toBe('detail');

    component.openEdit();
    expect(component.drawerMode()).toBe('form');
    component.onFormCancelled();
    expect(component.drawerMode()).toBe('detail');

    component.openPasswordReset();
    expect(component.drawerMode()).toBe('password');
    component.onFormCancelled();
    expect(component.drawerMode()).toBe('detail');
    expect(component.selectedUser()).toBe(seller);
  });

  it('closes the drawer and reloads after saving a user', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([admin]);
    component.openCreate();
    expect(component.drawerMode()).toBe('form');

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne(URL).flush([admin, seller]);
  });

  it('goes back to the sheet with a confirmation after a password reset', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([admin, seller]);
    component.openDetail(seller);
    component.openPasswordReset();

    component.onPasswordReset();

    expect(component.drawerMode()).toBe('detail');
    expect(component.notice()).toBe('Le mot de passe de Koffi Mensah a été réinitialisé.');
  });

  it('deactivates a user and updates the sheet and the row', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([admin, seller]);
    component.openDetail(seller);

    component.toggleActive();

    const req = httpTesting.expectOne(`${URL}/u2/deactivate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...seller, active: false });

    expect(component.selectedUser()?.active).toBe(false);
    expect(component.users()[1].active).toBe(false);
  });

  it('keeps the list visible when the backend refuses, e.g. for the last administrator', () => {
    const component = setup();
    const otherAdmin = { ...admin, id: 'u5', name: 'Autre admin' };
    httpTesting.expectOne(URL).flush([admin, otherAdmin]);
    component.openDetail(otherAdmin);

    component.toggleActive();
    httpTesting.expectOne(`${URL}/u5/deactivate`).flush(
      { status: 400, message: 'Cette opération laisserait le système sans administrateur actif', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.actionError()).toContain('sans administrateur actif');
    expect(component.error()).toBeNull();
  });

  it('deletes only after confirmation, then closes and reloads', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([admin, seller]);
    component.openDetail(seller);

    component.askDelete();
    httpTesting.expectNone(`${URL}/u2`);
    expect(component.deleteMessage()).toContain('Koffi Mensah');

    component.confirmDelete();
    const req = httpTesting.expectOne(`${URL}/u2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.drawerOpen()).toBe(false);
    httpTesting.expectOne(URL).flush([admin]);
  });

  it('does nothing when deletion is cancelled', () => {
    const component = setup();
    httpTesting.expectOne(URL).flush([seller]);
    component.openDetail(seller);

    component.askDelete();
    component.cancelDelete();

    httpTesting.expectNone(`${URL}/u2`);
    expect(component.userToDelete()).toBeNull();
  });
});
