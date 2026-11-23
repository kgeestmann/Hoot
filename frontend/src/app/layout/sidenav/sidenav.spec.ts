import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSidenav } from '@angular/material/sidenav';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';

import { AuthService, User } from '../../services/auth';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewService } from '../../services/overview';
import { NO_FILTERS, OverviewFiltersService } from '../../services/overview-filters';
import { PageTitle } from '../../services/page-title';
import { Sidenav } from './sidenav';

@Component({ template: '' })
class EmptyPage {}

const NO_INSTALLATIONS: GitHubAccess = { install_url: '', installations: [] };

describe('Sidenav', () => {
  let fixture: ComponentFixture<Sidenav>;
  let logout: ReturnType<typeof vi.fn>;

  async function render(
    user: User | null,
    {
      access = of(NO_INSTALLATIONS),
      wide = true,
      overview = NEVER,
    }: {
      access?: Observable<GitHubAccess>;
      wide?: boolean;
      overview?: Observable<Overview>;
    } = {},
  ) {
    logout = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Sidenav],
      providers: [
        provideRouter([
          { path: 'profile', component: EmptyPage },
          { path: 'github-access', component: EmptyPage },
        ]),
        {
          provide: AuthService,
          useValue: { user: signal(user), isLoggedIn: signal(!!user), logout },
        },
        { provide: GitHubAccessService, useValue: { load: () => access } },
        { provide: OverviewService, useValue: { load: () => overview } },
        {
          provide: OverviewFiltersService,
          useValue: { load: () => of(NO_FILTERS), save: () => of(NO_FILTERS) },
        },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of({ matches: wide, breakpoints: {} }),
            isMatched: () => wide,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidenav);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function navTitles(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.nav [matListItemTitle]')).map((title) =>
      title.textContent!.trim(),
    );
  }

  function menuItems(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[mat-menu-item]'));
  }

  const OCTOCAT: User = { id: 1, login: 'octocat' };

  it('offers only the sign-in when logged out', async () => {
    const element = await render(null);

    expect(navTitles(element)).toEqual(['Sign in']);
    expect(element.querySelector('.account-button')).toBeNull();
  });

  it('shows the overview and an account button with the initial and login', async () => {
    const element = await render(OCTOCAT);

    expect(navTitles(element)).toEqual([
      'Overview',
      'Pull requests',
      'Review requests',
      'Assigned issues',
      'Mentions',
    ]);
    const account = element.querySelector('.account-button')!;
    expect(account.querySelector('.avatar')!.textContent!.trim()).toBe('O');
    expect(account.querySelector('.login')!.textContent!.trim()).toBe('octocat');
  });

  it('opens a menu with Profile and Sign out from the account button', async () => {
    const element = await render(OCTOCAT);

    element.querySelector<HTMLButtonElement>('.account-button')!.click();
    await fixture.whenStable();

    expect(menuItems().map((item) => item.textContent!.trim())).toEqual(['Profile', 'Sign out']);
    menuItems()[1].click();
    expect(logout).toHaveBeenCalled();
  });

  it('lists the organizations where Hoot is installed under Teams', async () => {
    const element = await render(OCTOCAT, {
      access: of({
        install_url: '',
        installations: [
          { account: 'octocat', account_type: 'User', all_repositories: true, settings_url: '' },
          {
            account: 'Octo-Org',
            account_type: 'Organization',
            all_repositories: true,
            settings_url: '',
          },
        ],
      }),
    });

    expect(navTitles(element)).toEqual([
      'Overview',
      'Pull requests',
      'Review requests',
      'Assigned issues',
      'Mentions',
      'Octo-Org',
    ]);
    expect(element.querySelector('[mat-subheader]')!.textContent!.trim()).toBe('Teams');
    expect(element.querySelector('.nav-organization')!.getAttribute('href')).toBe('/orgs/Octo-Org');
  });

  it('shows no Teams section when the organizations cannot be loaded', async () => {
    const element = await render(OCTOCAT, { access: throwError(() => new Error('502')) });

    expect(navTitles(element)).toEqual([
      'Overview',
      'Pull requests',
      'Review requests',
      'Assigned issues',
      'Mentions',
    ]);
    expect(element.querySelector('[mat-subheader]')).toBeNull();
  });

  it("shows the current page's title in the top bar", async () => {
    const element = await render(OCTOCAT);

    TestBed.inject(PageTitle).current.set('Overview');
    await fixture.whenStable();

    expect(element.querySelector('.top-bar h1')!.textContent!.trim()).toBe('Overview');
  });

  it('links each list to its own page with an icon', async () => {
    const element = await render(OCTOCAT);

    const links = Array.from(element.querySelectorAll('a.nav-list'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/pull-requests',
      '/review-requests',
      '/assigned',
      '/mentions',
    ]);
    expect(
      links.map((link) => link.querySelector('mat-icon')?.getAttribute('data-mat-icon-name')),
    ).toEqual(['merge', 'rate_review', 'assignment_ind', 'alternate_email']);
  });

  it('shows how many items wait in each list', async () => {
    const issue = (number: number) => ({
      kind: 'issue' as const,
      title: `Issue ${number}`,
      repository: 'octo/hoot',
      number,
      url: `https://github.com/octo/hoot/issues/${number}`,
      updated_at: '2026-11-21T10:00:00Z',
      labels: [],
      comment_count: 0,
      milestone: null,
    });
    const allLoaded = { total: 0, has_more: false, search_url: '' };
    const element = await render(OCTOCAT, {
      overview: of({
        pull_requests: [],
        review_requests: [issue(1)],
        assigned_issues: [issue(2), issue(3)],
        mentions: [],
        totals: {
          pull_requests: allLoaded,
          review_requests: allLoaded,
          assigned_issues: { total: 80, has_more: true, search_url: '' },
          mentions: allLoaded,
        },
      }),
    });

    const counts = Array.from(element.querySelectorAll('a.nav-list')).map(
      (link) => link.querySelector('.nav-count')?.textContent?.trim() ?? '',
    );
    expect(counts).toEqual(['0', '1', '2+', '0']);
  });

  it('shows no counts until the overview has loaded', async () => {
    const element = await render(OCTOCAT);

    expect(element.querySelector('.nav-count')).toBeNull();
  });

  it('links to GitHub access at the bottom of the navigation', async () => {
    const element = await render(OCTOCAT);

    const link = element.querySelector('.secondary-nav a');
    expect(link?.textContent?.trim()).toBe('GitHub access');
    expect(link?.getAttribute('href')).toBe('/github-access');
  });

  it('shows the install banner when Hoot is installed nowhere', async () => {
    const element = await render(OCTOCAT, {
      access: of({
        install_url: 'https://github.com/apps/hoot/installations/new',
        installations: [],
      }),
    });

    expect(element.querySelector('app-install-banner')).not.toBeNull();
  });

  it('shows no install banner once Hoot is installed somewhere', async () => {
    const element = await render(OCTOCAT, {
      access: of({
        install_url: '',
        installations: [
          { account: 'octocat', account_type: 'User', all_repositories: true, settings_url: '' },
        ],
      }),
    });

    expect(element.querySelector('app-install-banner')).toBeNull();
  });

  it('hides the install banner on the GitHub access page itself', async () => {
    const element = await render(OCTOCAT, {
      access: of({
        install_url: 'https://github.com/apps/hoot/installations/new',
        installations: [],
      }),
    });

    await TestBed.inject(Router).navigateByUrl('/github-access');
    await fixture.whenStable();

    expect(element.querySelector('app-install-banner')).toBeNull();
  });

  describe('layout', () => {
    function drawer(): MatSidenav {
      return fixture.debugElement.query(By.directive(MatSidenav)).componentInstance;
    }

    function menuButton(element: HTMLElement): HTMLButtonElement | null {
      return element.querySelector('[aria-label="Open navigation"]');
    }

    it('keeps the navigation open beside the content on wide screens', async () => {
      const element = await render(OCTOCAT, { wide: true });

      expect(drawer().mode).toBe('side');
      expect(drawer().opened).toBe(true);
      expect(menuButton(element)).toBeNull();
    });

    it('hides the navigation in a drawer behind a menu button on small screens', async () => {
      const element = await render(OCTOCAT, { wide: false });

      expect(drawer().mode).toBe('over');
      expect(drawer().opened).toBe(false);

      menuButton(element)!.click();
      await fixture.whenStable();

      expect(drawer().opened).toBe(true);
    });

    it('closes the drawer once a page is chosen on small screens', async () => {
      const element = await render(OCTOCAT, { wide: false });
      menuButton(element)!.click();
      await fixture.whenStable();

      await TestBed.inject(Router).navigateByUrl('/profile');
      await fixture.whenStable();

      expect(drawer().opened).toBe(false);
    });
  });
});
