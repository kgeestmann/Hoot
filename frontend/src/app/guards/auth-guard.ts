import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../services/auth';

/** Lets only logged-in users through and sends everyone else to /login. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService)
    .loadSession()
    .pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};
