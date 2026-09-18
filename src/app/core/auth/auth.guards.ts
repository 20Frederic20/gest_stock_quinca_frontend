import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Permission } from './permissions';

/** The session is restored before the first navigation (app initializer), so these checks are synchronous. */

/** Screens of the application: anonymous visitors go to the login page, then come back. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).user()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** The login page: a logged-in user has nothing to do there. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).user() ? inject(Router).createUrlTree(['/']) : true;

/** The site root: a visitor sees the public homepage; a logged-in user goes straight to the dashboard. */
export const homeGuard: CanActivateFn = () =>
  inject(AuthService).user() ? inject(Router).createUrlTree(['/dashboard']) : true;

/** A screen reserved to some roles, e.g. users management. */
export function permissionGuard(permission: Permission): CanActivateFn {
  return () => (inject(AuthService).can(permission) ? true : inject(Router).createUrlTree(['/']));
}
