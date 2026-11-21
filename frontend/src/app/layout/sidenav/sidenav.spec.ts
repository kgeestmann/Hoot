import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../services/auth';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Sidenav } from './sidenav';

describe('Sidenav', () => {
  let component: Sidenav;
  let fixture: ComponentFixture<Sidenav>;

  async function render(
    loggedIn: boolean,
    access: Observable<GitHubAccess> = of({ install_url: '', installations: [] }),
  ) {
    await TestBed.configureTestingModule({
      imports: [Sidenav],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn), logout: vi.fn() } },
        { provide: GitHubAccessService, useValue: { load: () => access } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidenav);
    component = fixture.componentInstance;
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function navLabels(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.nav-btn')).map((link) => link.textContent!.trim());
  }

  it('should create', async () => {
    await render(false);
    expect(component).toBeTruthy();
  });

  it('shows Login when logged out', async () => {
    const element = await render(false);
    expect(navLabels(element)).toEqual(['Login']);
  });

  it('shows Overview, Profile and Logout when logged in', async () => {
    const element = await render(true);
    expect(navLabels(element)).toEqual(['Overview', 'Profile', 'Logout']);
  });

  it('lists the organizations where Hoot is installed under Overview', async () => {
    const element = await render(
      true,
      of({
        install_url: '',
        installations: [
          { account: 'kgeestmann', account_type: 'User', all_repositories: true, settings_url: '' },
          {
            account: 'Octo-Org',
            account_type: 'Organization',
            all_repositories: true,
            settings_url: '',
          },
        ],
      }),
    );

    expect(navLabels(element)).toEqual(['Overview', 'Octo-Org', 'Profile', 'Logout']);
    expect(
      element.querySelector<HTMLAnchorElement>('.nav-organization')!.getAttribute('href'),
    ).toBe('/orgs/Octo-Org');
  });

  it('shows no organizations when they cannot be loaded', async () => {
    const element = await render(
      true,
      throwError(() => new Error('502')),
    );

    expect(navLabels(element)).toEqual(['Overview', 'Profile', 'Logout']);
  });
});
