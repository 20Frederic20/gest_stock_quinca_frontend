import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { User, UserRequest, UserUpdateRequest } from '../../core/models/user.model';

/** Calls to the backend UserController, on /api/v1 as required by the API contract. */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private url = '/api/v1/users';

  /** Sorted by name, inactive users included. */
  getAll() {
    return this.http.get<User[]>(this.url);
  }

  getByAgency(agencyId: string) {
    return this.http.get<User[]>(`/api/v1/agencies/${agencyId}/users`);
  }

  getById(id: string) {
    return this.http.get<User>(`${this.url}/${id}`);
  }

  create(body: UserRequest) {
    return this.http.post<User>(this.url, body);
  }

  /** The password is not part of it: it has its own endpoints. */
  update(id: string, body: UserUpdateRequest) {
    return this.http.put<User>(`${this.url}/${id}`, body);
  }

  /** By the user themselves: the current password is required. */
  changePassword(id: string, currentPassword: string, newPassword: string) {
    return this.http.put<void>(`${this.url}/${id}/password`, { currentPassword, newPassword });
  }

  /** By an administrator: the current password is not needed. */
  resetPassword(id: string, newPassword: string) {
    return this.http.put<void>(`${this.url}/${id}/password/reset`, { newPassword });
  }

  activate(id: string) {
    return this.http.patch<User>(`${this.url}/${id}/activate`, null);
  }

  /** Refused by the backend for the last active administrator. */
  deactivate(id: string) {
    return this.http.patch<User>(`${this.url}/${id}/deactivate`, null);
  }

  /** Refused by the backend for the last active administrator. */
  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
