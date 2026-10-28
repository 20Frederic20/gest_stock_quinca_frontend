import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ApiError } from './api-error.model';

/**
 * Turns every HTTP error into an `ApiError`.
 * Components never have to deal with `HttpErrorResponse`.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((response: HttpErrorResponse) => {
      // A request made with `responseType: 'blob'` (a PDF download, say) gets its error body
      // as a Blob too, whatever the server actually sent: the browser decided before the
      // response arrived. The backend still writes JSON, so it has to be read back out.
      if (response.error instanceof Blob && response.error.type.includes('json')) {
        return from(response.error.text()).pipe(
          switchMap(text => throwError(() => toApiError(response, text ? JSON.parse(text) : null))),
        );
      }
      return throwError(() => toApiError(response));
    }),
  );

function toApiError(response: HttpErrorResponse, parsedBody?: unknown): ApiError {
  const status = response.status;

  if (status === 0) {
    return { status, message: "Le serveur est injoignable. Vérifiez qu'il est démarré.", fieldErrors: {} };
  }

  // Body sent by the backend GlobalExceptionHandler. `parsedBody` overrides `response.error`
  // when the latter arrived as a Blob (see the interceptor above) and had to be read back out.
  const body = (parsedBody ?? response.error) as
    | { message?: string; fieldErrors?: Record<string, string> | null }
    | null;

  if (body?.fieldErrors) {
    // The backend writes "Donnees invalides" without accents: generic label, rewritten here.
    return { status, message: 'Données invalides', fieldErrors: body.fieldErrors };
  }

  if (body?.message) {
    return { status, message: body.message, fieldErrors: {} };
  }

  return { status, message: `Une erreur est survenue (code ${status}).`, fieldErrors: {} };
}
