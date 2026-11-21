import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSidenav } from '@angular/material/sidenav';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../services/auth';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Sidenav } from './sidenav';

@Component({ template: '' })
class EmptyPage {}

describe('Sidenav', () => {
  let component: Sidenav;
  let fixture: ComponentFixture<Sidenav>;

  async function render(
    loggedIn: boolean,
    access: Observable<GitHubAccess> = of({ install_url: '', installations: [] }),
    wide = true,
  ) {
    await TestBed.configureTestingModule({
      imports: [Sidenav],
      providers: [
        provideRouter([{ path: 'profile', component: EmptyPage }]),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of({ matches: wide, breakpoints: {} }),
            isMatched: () => wide,
          },
        },
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

  describe('layout', () => {
    function drawer(): MatSidenav {
      return fixture.debugElement.query(By.directive(MatSidenav)).componentInstance;
    }

    it('keeps the navigation open beside the content on wide screens', async () => {
      const element = await render(true, undefined, true);

      expect(drawer().mode).toBe('side');
      expect(drawer().opened).toBe(true);
      expect(element.querySelector('.top-bar')).toBeNull();
    });

    it('hides the navigation in a drawer behind a menu button on small screens', async () => {
      const element = await render(true, undefined, false);

      expect(drawer().mode).toBe('over');
      expect(drawer().opened).toBe(false);
      const menu = element.querySelector<HTMLButtonElement>('.top-bar button');
      expect(menu?.getAttribute('aria-label')).toBe('Open navigation');

      menu!.click();
      await fixture.whenStable();

      expect(drawer().opened).toBe(true);
    });

    it('closes the drawer once a page is chosen on small screens', async () => {
      const element = await render(true, undefined, false);
      element.querySelector<HTMLButtonElement>('.top-bar button')!.click();
      await fixture.whenStable();

      await TestBed.inject(Router).navigateByUrl('/profile');
      await fixture.whenStable();

      expect(drawer().opened).toBe(false);
    });
  });
});
