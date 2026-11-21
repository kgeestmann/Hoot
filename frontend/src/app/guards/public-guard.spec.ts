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
import { publicGuard } from './public-guard';

describe('publicGuard', () => {
  function runGuard(user: User | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { loadSession: () => of(user) } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      publicGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('lets logged-out users through', async () => {
    expect(await runGuard(null)).toBe(true);
  });

  it('sends logged-in users to /profile', async () => {
    const result = await runGuard({ id: 1, login: 'octocat' });

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/profile');
  });
});
