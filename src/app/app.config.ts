import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { unauthorizedInterceptor } from './core/auth/unauthorized.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Input binding: the login page receives `?redirect=` as an input.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      // unauthorizedInterceptor last, so that it sees the 401 before errorInterceptor turns it into an ApiError.
      withInterceptors([errorInterceptor, unauthorizedInterceptor]),
      // Angular's defaults, written out because the backend must use the same names (see the API contract).
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    // The session check starts right away but is not awaited: the public homepage must not wait for it.
    // The guards of the private screens wait for it (see auth.guards.ts).
    provideAppInitializer(() => {
      void inject(AuthService).ensureRestored();
    }),
  ],
};
