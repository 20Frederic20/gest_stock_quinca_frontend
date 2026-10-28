import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Permission } from './permissions';

/**
 * The session check starts at startup but does not hold the application back (the public homepage
 * needs no answer): the guards that do need it wait for it here.
 */

/** Screens of the application: anonymous visitors go to the login page, then come back. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureRestored();
  return auth.user() ? true : router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** The login page: a logged-in user has nothing to do there and goes to the dashboard. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureRestored();
  return auth.user() ? router.createUrlTree(['/dashboard']) : true;
};

/**
 * A screen reserved to some roles, e.g. users management. Always used inside a screen already
 * protected by authGuard, so the session is known by then.
 */
export function permissionGuard(permission: Permission): CanActivateFn {
  return () => (inject(AuthService).can(permission) ? true : inject(Router).createUrlTree(['/dashboard']));
}
