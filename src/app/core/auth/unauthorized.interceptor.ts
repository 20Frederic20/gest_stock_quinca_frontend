import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthService } from './auth.service';

/** Their 401 is an expected answer, handled where they are called. */
const HANDLED_ELSEWHERE = ['/api/v1/auth/csrf', '/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/me'];

/**
 * A 401 on any other call means the session has expired or the account was deactivated:
 * forget the user and go to the login page, which brings them back here afterwards.
 * Must be listed after errorInterceptor, so that it still sees the HTTP status.
 */
export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    tap({
      error: (error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 401) return;
        if (HANDLED_ELSEWHERE.includes(req.url)) return;

        auth.setUser(null);
        const current = router.url;
        const target = current.startsWith('/login') ? '/login' : `/login?redirect=${encodeURIComponent(current)}`;
        void router.navigateByUrl(target);
      },
    }),
  );
};
