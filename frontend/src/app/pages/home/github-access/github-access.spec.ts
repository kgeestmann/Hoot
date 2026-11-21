import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { GitHubAccess, GitHubAccessService } from '../../../services/github-access';
import { GitHubAccessCard } from './github-access';

const INSTALL_URL = 'https://github.com/apps/hoot/installations/new';

describe('GitHubAccessCard', () => {
  async function render(load: Observable<GitHubAccess>) {
    await TestBed.configureTestingModule({
      imports: [GitHubAccessCard],
      providers: [{ provide: GitHubAccessService, useValue: { load: () => load } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(GitHubAccessCard);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('asks to install Hoot when it is installed nowhere', async () => {
    const element = await render(of({ install_url: INSTALL_URL, installations: [] }));

    const link = element.querySelector<HTMLAnchorElement>('.install-link');
    expect(link?.href).toBe(INSTALL_URL);
    expect(text(element.querySelector('h3'))).toBe('Install Hoot on GitHub');
    expect(element.querySelector('.installations')).toBeNull();
  });

  it('lists the accounts Hoot can see and links to add more', async () => {
    const element = await render(
      of({
        install_url: INSTALL_URL,
        installations: [
          {
            account: 'octocat',
            account_type: 'User',
            all_repositories: true,
            settings_url: 'https://github.com/settings/installations/1',
          },
          {
            account: 'octo-org',
            account_type: 'Organization',
            all_repositories: false,
            settings_url: 'https://github.com/organizations/octo-org/settings/installations/2',
          },
        ],
      }),
    );

    const rows = Array.from(element.querySelectorAll('.installation'));
    expect(rows.map((row) => text(row.querySelector('.account')))).toEqual(['octocat', 'octo-org']);
    expect(rows.map((row) => text(row.querySelector('.scope')))).toEqual([
      'All repositories',
      'Selected repositories',
    ]);
    expect(rows[1].querySelector<HTMLAnchorElement>('.manage-link')?.href).toBe(
      'https://github.com/organizations/octo-org/settings/installations/2',
    );
    expect(element.querySelector<HTMLAnchorElement>('.add-link')?.href).toBe(INSTALL_URL);
    expect(element.querySelector('.install-link')).toBeNull();
  });

  it('shows an error when the installations cannot be loaded', async () => {
    const element = await render(throwError(() => new Error('502')));

    expect(text(element.querySelector('[role="alert"]'))).toContain("Couldn't load");
  });
});
