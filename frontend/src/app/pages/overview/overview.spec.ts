import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';

import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewItem, OverviewService } from '../../services/overview';
import { OverviewFiltersService } from '../../services/overview-filters';
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
  let filters: {
    load: () => Observable<string[]>;
    save: ReturnType<typeof vi.fn<(hidden: string[]) => Observable<string[]>>>;
  };

  beforeEach(() => {
    filters = { load: () => of([]), save: vi.fn((hidden: string[]) => of(hidden)) };
  });

  async function render(overview: () => Observable<Overview>, access: Observable<GitHubAccess>) {
    await TestBed.configureTestingModule({
      imports: [OverviewPage],
      providers: [
        { provide: OverviewService, useValue: { load: overview } },
        { provide: GitHubAccessService, useValue: { load: () => access } },
        { provide: OverviewFiltersService, useValue: filters },
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

  describe('with filters', () => {
    const OVERVIEW: Overview = {
      ...EMPTY,
      assigned_issues: [
        { ...ISSUE, repository: 'dipt-pa1469-ht26/team-14', number: 3 },
        { ...ISSUE, repository: 'kgeestmann/hoot', number: 4 },
      ],
      mentions: [{ ...ISSUE, repository: 'kgeestmann/old-repo', number: 5 }],
    };

    function filterCheckbox(element: HTMLElement, label: string): HTMLInputElement {
      const option = Array.from(element.querySelectorAll('app-overview-filters label')).find(
        (candidate) => candidate.textContent!.trim() === label,
      );
      return option!.querySelector('input')!;
    }

    it('leaves out what the user hid and says how much is hidden', async () => {
      filters.load = () => of(['dipt-pa1469-ht26', 'kgeestmann/old-repo']);

      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(headings(element)).toEqual([
        'Your pull requests 0',
        'Review requests 0',
        'Assigned issues 1',
        'Mentions 0',
      ]);
      expect(element.querySelector('.hidden-count')!.textContent!.trim()).toBe('2 hidden');
    });

    it('hides an owner when its checkbox is unchecked and saves that', async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      filterCheckbox(element, 'dipt-pa1469-ht26').click();
      await fixture.whenStable();

      expect(headings(element)).toContain('Assigned issues 1');
      expect(filters.save).toHaveBeenCalledWith(['dipt-pa1469-ht26']);
    });

    it('shows a hidden repository again when its checkbox is checked', async () => {
      filters.load = () => of(['kgeestmann/old-repo']);
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      filterCheckbox(element, 'kgeestmann/old-repo').click();
      await fixture.whenStable();

      expect(headings(element)).toContain('Mentions 1');
      expect(filters.save).toHaveBeenCalledWith([]);
    });

    it('shows everything when the filters cannot be loaded', async () => {
      filters.load = () => throwError(() => new HttpErrorResponse({ status: 500 }));

      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(headings(element)).toContain('Assigned issues 2');
    });

    it('warns when a filter change cannot be saved, but keeps applying it', async () => {
      filters.save = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      filterCheckbox(element, 'dipt-pa1469-ht26').click();
      await fixture.whenStable();

      expect(element.querySelector('app-overview-filters [role="alert"]')).not.toBeNull();
      expect(headings(element)).toContain('Assigned issues 1');
    });

    it('saves changes one after the other, so the last one is stored', async () => {
      const pending: Subject<string[]>[] = [];
      filters.save = vi.fn(() => {
        const save = new Subject<string[]>();
        pending.push(save);
        return save;
      });
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      filterCheckbox(element, 'dipt-pa1469-ht26').click();
      filterCheckbox(element, 'kgeestmann/hoot').click();
      expect(filters.save).toHaveBeenCalledTimes(1);

      pending[0].next([]);
      pending[0].complete();

      expect(filters.save).toHaveBeenLastCalledWith(['dipt-pa1469-ht26', 'kgeestmann/hoot']);
    });
  });
});
