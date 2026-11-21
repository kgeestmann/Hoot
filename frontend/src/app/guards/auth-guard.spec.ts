import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';

import { AuthService, User } from '../services/auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  function runGuard(user: User | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { loadSession: () => of(user) } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('lets logged-in users through', async () => {
    expect(await runGuard({ id: 1, email: 'user@example.com' })).toBe(true);
  });

  it('sends everyone else to /login', async () => {
    const result = await runGuard(null);

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});
