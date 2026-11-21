import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../services/auth';

/** Keeps logged-in users away from pages like /login and sends them to the overview. */
export const publicGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService)
    .loadSession()
    .pipe(map((user) => (user ? router.createUrlTree(['/']) : true)));
};
