import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { API_URL } from '../api';
import { AuthService } from './auth';

/**
 * Sends the session cookie with every backend request. A 401 during an active
 * session means it expired, so the user is sent back to the login page.
 */
export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_URL)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return next(request.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && auth.isLoggedIn()) {
        auth.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
