import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';

import { AuthService } from '../../services/auth';
import { GitHubAccessService } from '../../services/github-access';
import { Home } from './home';

describe('Home', () => {
  async function render(loggedIn: boolean) {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn) } },
        { provide: GitHubAccessService, useValue: { load: () => NEVER } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the GitHub access card when logged in', async () => {
    const element = await render(true);
    expect(element.querySelector('app-github-access')).not.toBeNull();
  });

  it('does not load GitHub access when logged out', async () => {
    const element = await render(false);
    expect(element.querySelector('app-github-access')).toBeNull();
  });
});
