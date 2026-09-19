import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../http/api-error.model';
import { CurrentUser } from '../models/user.model';
import { PERMISSIONS_ENABLED, Permission, can } from './permissions';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

const URL = '/api/v1/auth';

/**
 * Who is logged in. The access token lives in an HttpOnly cookie that the front never reads:
 * the only way to know is to ask the backend (/auth/me).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private permissionsEnabled = inject(PERMISSIONS_ENABLED);

  user = signal<CurrentUser | null>(null);
  status = signal<AuthStatus>('unknown');
  /** Set when the session check failed for another reason than "not logged in" (server down…). */
  startupError = signal<string | null>(null);

  /** Checks the session with the backend. Never fails; prefer ensureRestored(), which runs it only once. */
  restore(): Promise<void> {
    return new Promise(resolve => {
      this.csrfCookie()
        .pipe(switchMap(() => this.http.get<CurrentUser>(`${URL}/me`)))
        .subscribe({
          next: user => {
            this.setUser(user);
            resolve();
          },
          error: (error: ApiError) => {
            this.setUser(null);
            this.startupError.set(error.status === 401 ? null : error.message);
            resolve();
          },
        });
    });
  }

  private restoration: Promise<void> | null = null;

  /**
   * Waits for the session check, starting it if nobody has yet. The guards of the private screens
   * wait here; the public homepage does not, so it is shown at once instead of after two round trips.
   */
  ensureRestored(): Promise<void> {
    if (this.status() !== 'unknown') return Promise.resolve();
    return (this.restoration ??= this.restore());
  }

  /** The backend answers with the access cookie and no body: /me tells who is logged in. */
  login(username: string, password: string): Observable<CurrentUser> {
    return this.http.post<void>(`${URL}/login`, { username, password }).pipe(
      switchMap(() => this.http.get<CurrentUser>(`${URL}/me`)),
      tap(user => {
        this.startupError.set(null);
        this.setUser(user);
      }),
    );
  }

  /** The user is forgotten on this side whatever the server answers. */
  logout(): Observable<void> {
    return this.http.post<void>(`${URL}/logout`, null).pipe(finalize(() => this.setUser(null)));
  }

  setUser(user: CurrentUser | null): void {
    this.user.set(user);
    this.status.set(user ? 'authenticated' : 'anonymous');
  }

  /** While permissions are disabled, being logged in is enough. */
  can(permission: Permission, agencyId?: string): boolean {
    if (!this.permissionsEnabled) return this.user() !== null;
    return can(this.user(), permission, agencyId);
  }

  /**
   * Makes the backend set the XSRF-TOKEN cookie, which Angular then copies into X-XSRF-TOKEN
   * on every write (logout included). A failure is not blocking: the session check goes on.
   */
  private csrfCookie(): Observable<unknown> {
    return this.http.get<void>(`${URL}/csrf`).pipe(catchError(() => of(null)));
  }
}
