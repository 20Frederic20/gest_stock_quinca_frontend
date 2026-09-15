import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from './api-error.model';

/**
 * Turns every HTTP error into an `ApiError`.
 * Components never have to deal with `HttpErrorResponse`.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((response: HttpErrorResponse) => throwError(() => toApiError(response))),
  );

function toApiError(response: HttpErrorResponse): ApiError {
  const status = response.status;

  if (status === 0) {
    return { status, message: "Le serveur est injoignable. Vérifiez qu'il est démarré.", fieldErrors: {} };
  }

  // Body sent by the backend GlobalExceptionHandler.
  const body = response.error as { message?: string; fieldErrors?: Record<string, string> | null } | null;

  if (body?.fieldErrors) {
    // The backend writes "Donnees invalides" without accents: generic label, rewritten here.
    return { status, message: 'Données invalides', fieldErrors: body.fieldErrors };
  }

  if (body?.message) {
    return { status, message: body.message, fieldErrors: {} };
  }

  return { status, message: `Une erreur est survenue (code ${status}).`, fieldErrors: {} };
}
