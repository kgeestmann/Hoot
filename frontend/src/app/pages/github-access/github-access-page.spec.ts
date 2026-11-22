import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, throwError } from 'rxjs';

import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { GitHubAccessPage } from './github-access-page';

const ACCESS: GitHubAccess = {
  install_url: 'https://github.com/apps/hoot/installations/new',
  installations: [
    {
      account: 'octocat',
      account_type: 'User',
      all_repositories: true,
      settings_url: 'https://github.com/settings/installations/1',
    },
  ],
};

describe('GitHubAccessPage', () => {
  async function render(answers: Observable<GitHubAccess>[]) {
    await TestBed.configureTestingModule({
      imports: [GitHubAccessPage],
      providers: [{ provide: GitHubAccessService, useValue: { load: () => answers.shift()! } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(GitHubAccessPage);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows progress while loading', async () => {
    const { element } = await render([NEVER]);

    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('shows where Hoot is installed', async () => {
    const { element } = await render([of(ACCESS)]);

    expect(element.querySelector('app-github-access .account')?.textContent?.trim()).toBe(
      'octocat',
    );
  });

  it('offers a retry when loading fails', async () => {
    const { fixture, element } = await render([
      throwError(() => new HttpErrorResponse({ status: 502 })),
      of(ACCESS),
    ]);

    element.querySelector<HTMLButtonElement>('.retry')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('app-github-access')).not.toBeNull();
  });
});
