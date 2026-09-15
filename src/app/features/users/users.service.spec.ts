import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserRequest } from '../../core/models/user.model';
import { UsersService } from './users.service';

const URL = '/api/v1/users';

const body: UserRequest = {
  name: 'Koffi Mensah', username: 'koffi.mensah', password: 'secret-123', role: 'SELLER', discountLimit: 5, agencyId: 'g1',
};

describe('UsersService', () => {
  let service: UsersService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets all users', () => {
    service.getAll().subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets the users of an agency', () => {
    service.getByAgency('g1').subscribe();

    const req = httpTesting.expectOne('/api/v1/agencies/g1/users');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets one user by id', () => {
    service.getById('u2').subscribe();

    const req = httpTesting.expectOne(`${URL}/u2`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates a user, password included', () => {
    service.create(body).subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates a user, without any password', () => {
    const { password: _password, ...update } = body;
    service.update('u2', update).subscribe();

    const req = httpTesting.expectOne(`${URL}/u2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(update);
    req.flush({});
  });

  it('changes a password, the current one being required', () => {
    service.changePassword('u2', 'old-secret', 'new-secret-1').subscribe();

    const req = httpTesting.expectOne(`${URL}/u2/password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ currentPassword: 'old-secret', newPassword: 'new-secret-1' });
    req.flush(null);
  });

  it('resets a password without knowing the current one', () => {
    service.resetPassword('u2', 'new-secret-1').subscribe();

    const req = httpTesting.expectOne(`${URL}/u2/password/reset`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newPassword: 'new-secret-1' });
    req.flush(null);
  });

  it('activates a user', () => {
    service.activate('u2').subscribe();

    const req = httpTesting.expectOne(`${URL}/u2/activate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deactivates a user', () => {
    service.deactivate('u2').subscribe();

    const req = httpTesting.expectOne(`${URL}/u2/deactivate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deletes a user', () => {
    service.delete('u2').subscribe();

    const req = httpTesting.expectOne(`${URL}/u2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
