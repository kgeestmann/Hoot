import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';

import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewItem, OverviewService } from '../../services/overview';
import { OverviewPage } from './overview';

const INSTALLED: GitHubAccess = {
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
const INSTALLED_NOWHERE: GitHubAccess = { ...INSTALLED, installations: [] };

const ISSUE: OverviewItem = {
  kind: 'issue',
  title: 'Login button does nothing',
  repository: 'octo/hoot',
  number: 1,
  url: 'https://github.com/octo/hoot/issues/1',
  updated_at: '2026-11-21T10:00:00Z',
};

const EMPTY: Overview = {
  assigned_issues: [],
  pull_requests: [],
  review_requests: [],
  mentions: [],
};

describe('OverviewPage', () => {
  let fixture: ComponentFixture<OverviewPage>;

  async function render(overview: () => Observable<Overview>, access: Observable<GitHubAccess>) {
    await TestBed.configureTestingModule({
      imports: [OverviewPage],
      providers: [
        { provide: OverviewService, useValue: { load: overview } },
        { provide: GitHubAccessService, useValue: { load: () => access } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function headings(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('app-overview-section h2')).map((heading) =>
      heading.textContent!.replace(/\s+/g, ' ').trim(),
    );
  }

  it('shows a skeleton while loading', async () => {
    const element = await render(() => NEVER, NEVER);

    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(element.querySelectorAll('.skeleton-section').length).toBe(4);
  });

  it('shows the four sections with their item counts', async () => {
    const element = await render(
      () => of({ ...EMPTY, assigned_issues: [ISSUE], mentions: [ISSUE, { ...ISSUE, number: 2 }] }),
      of(INSTALLED),
    );

    expect(headings(element)).toEqual([
      'Your pull requests 0',
      'Review requests 0',
      'Assigned issues 1',
      'Mentions 2',
    ]);
    expect(element.querySelector('[aria-busy]')).toBeNull();
  });

  it('shows where Hoot is installed below the sections', async () => {
    const element = await render(() => of({ ...EMPTY, assigned_issues: [ISSUE] }), of(INSTALLED));

    const card = element.querySelector('app-github-access');
    expect(card?.textContent).toContain('octocat');
    expect(element.querySelector('.sections')!.compareDocumentPosition(card!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('says so when nothing is waiting', async () => {
    const element = await render(() => of(EMPTY), of(INSTALLED));

    expect(element.querySelector('.all-clear')?.textContent).toContain('Nothing waiting on you');
    expect(element.querySelector('app-overview-section')).toBeNull();
  });

  it('only asks to install Hoot when it is installed nowhere', async () => {
    const element = await render(() => of(EMPTY), of(INSTALLED_NOWHERE));

    expect(element.querySelector('.install-link')).not.toBeNull();
    expect(element.querySelector('.all-clear')).toBeNull();
    expect(element.querySelector('app-overview-section')).toBeNull();
  });

  it('still shows the overview when GitHub access cannot be loaded', async () => {
    const element = await render(
      () => of({ ...EMPTY, assigned_issues: [ISSUE] }),
      throwError(() => new Error('502')),
    );

    expect(headings(element)).toContain('Assigned issues 1');
    expect(element.querySelector('app-github-access')).toBeNull();
  });

  it.each([
    [0, "Can't reach Hoot's server"],
    [502, "GitHub didn't answer"],
  ])('explains a failed load (status %i) and offers a retry', async (status, message) => {
    const element = await render(
      () => throwError(() => new HttpErrorResponse({ status })),
      of(INSTALLED),
    );

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(element.querySelector('.retry')?.textContent?.trim()).toBe('Try again');
  });

  it('loads again when retrying', async () => {
    const answers = [
      throwError(() => new HttpErrorResponse({ status: 502 })),
      of({ ...EMPTY, review_requests: [ISSUE] }),
    ];
    const element = await render(() => answers.shift()!, of(INSTALLED));

    element.querySelector<HTMLButtonElement>('.retry')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(headings(element)).toContain('Review requests 1');
  });

  it('shows the skeleton again while retrying', async () => {
    const retry = new Subject<Overview>();
    const answers: Observable<Overview>[] = [
      throwError(() => new HttpErrorResponse({ status: 502 })),
      retry,
    ];
    const element = await render(() => answers.shift()!, of(INSTALLED));

    element.querySelector<HTMLButtonElement>('.retry')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
