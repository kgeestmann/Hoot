import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';

import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewItem, OverviewService } from '../../services/overview';
import {
  NO_FILTERS,
  OverviewFilters,
  OverviewFiltersService,
} from '../../services/overview-filters';
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

function item(repository: string, number: number, labels: string[] = []): OverviewItem {
  return {
    kind: 'issue',
    title: `Issue ${number}`,
    repository,
    number,
    url: `https://github.com/${repository}/issues/${number}`,
    updated_at: '2026-11-21T10:00:00Z',
    labels: labels.map((name) => ({ name, color: 'd73a4a' })),
  };
}

const ALL_LOADED = { total: 0, has_more: false, search_url: '' };
const NO_MORE: Overview['totals'] = {
  assigned_issues: ALL_LOADED,
  pull_requests: ALL_LOADED,
  review_requests: ALL_LOADED,
  mentions: ALL_LOADED,
};

const EMPTY: Overview = {
  assigned_issues: [],
  pull_requests: [],
  review_requests: [],
  mentions: [],
  totals: NO_MORE,
};

/** Three assigned issues in two owners, one with the label "bug", and one mention. */
const OVERVIEW: Overview = {
  ...EMPTY,
  assigned_issues: [
    item('dipt-pa1469-ht26/team-14', 3),
    item('kgeestmann/hoot', 4, ['bug']),
    item('kgeestmann/old-repo', 5),
  ],
  mentions: [item('kgeestmann/hoot', 6)],
};

describe('OverviewPage', () => {
  let fixture: ComponentFixture<OverviewPage>;
  let filters: {
    load: () => Observable<OverviewFilters>;
    save: ReturnType<typeof vi.fn<(filters: OverviewFilters) => Observable<OverviewFilters>>>;
  };

  beforeEach(() => {
    filters = {
      load: () => of(NO_FILTERS),
      save: vi.fn((saved: OverviewFilters) => of(saved)),
    };
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

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  /** A tab's label with its count, e.g. "Assigned 3". */
  function tabText(tab: Element | null): string {
    return `${text(tab?.querySelector('.tab-label') ?? null)} ${text(tab?.querySelector('.tab-count') ?? null)}`;
  }

  function tabs(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('[role="tab"]')).map(tabText);
  }

  function selectedTab(element: HTMLElement): string {
    return tabText(element.querySelector('[role="tab"][aria-selected="true"]'));
  }

  /** Titles of the rows in the open tab. */
  function rows(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('a.item .title')).map(text);
  }

  async function openTab(element: HTMLElement, label: string): Promise<void> {
    const tab = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (candidate) => text(candidate).startsWith(label),
    );
    tab!.click();
    await fixture.whenStable();
  }

  /** Open a filter menu ("Owner", "Repository", "Label") and click one of its options. */
  async function clickFilterOption(element: HTMLElement, menu: string, option: string) {
    const button = Array.from(element.querySelectorAll<HTMLElement>('.filter-button')).find(
      (candidate) => text(candidate).startsWith(menu),
    );
    button!.click();
    await fixture.whenStable();
    const choice = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
    ).find((candidate) => text(candidate) === option);
    choice!.click();
    await fixture.whenStable();
  }

  it('shows a skeleton while loading', async () => {
    const element = await render(() => NEVER, NEVER);

    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows the four lists as tabs with their counts', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(tabs(element)).toEqual([
      'My pull requests 0',
      'Review requests 0',
      'Assigned 3',
      'Mentions 1',
    ]);
    expect(element.querySelector('[aria-busy]')).toBeNull();
  });

  it('opens on the first tab that has items', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(selectedTab(element)).toBe('Assigned 3');
    expect(rows(element)).toEqual(['Issue 3', 'Issue 4', 'Issue 5']);
  });

  it('shows the items of another tab when it is chosen', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    await openTab(element, 'Mentions');

    expect(rows(element)).toEqual(['Issue 6']);
  });

  it('links to the rest of a list GitHub cut off', async () => {
    const searchUrl = 'https://github.com/search?q=assignee%3A%40me&type=issues';
    const element = await render(
      () =>
        of({
          ...OVERVIEW,
          totals: {
            ...NO_MORE,
            assigned_issues: { total: 70, has_more: true, search_url: searchUrl },
          },
        }),
      of(INSTALLED),
    );

    expect(tabs(element)).toContain('Assigned 3');
    const more = element.querySelector<HTMLAnchorElement>('.more-link');
    expect(text(more)).toBe('Show all 70 on GitHub');
    expect(more?.href).toBe(searchUrl);
  });

  it('has no link to more when GitHub returned the whole list', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(element.querySelector('.more-link')).toBeNull();
  });

  it('leaves GitHub access to its own page', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(element.querySelector('app-github-access')).toBeNull();
  });

  it('says so when nothing is waiting, and keeps the tabs', async () => {
    const element = await render(() => of(EMPTY), of(INSTALLED));

    expect(element.querySelector('.all-clear')?.textContent).toContain('Nothing waiting on you');
    expect(element.querySelector('.all-clear mat-icon')?.getAttribute('data-mat-icon-name')).toBe(
      'task_alt',
    );
    expect(tabs(element)).toEqual([
      'My pull requests 0',
      'Review requests 0',
      'Assigned 0',
      'Mentions 0',
    ]);
    expect(text(element.querySelector('.empty'))).toBe('You have no open pull requests.');
  });

  it('hides the empty filter menus when nothing is waiting', async () => {
    const element = await render(() => of(EMPTY), of(INSTALLED));

    expect(element.querySelector('app-filter-bar')).toBeNull();
    expect(element.querySelector('app-refresh-status')).not.toBeNull();
  });

  it('keeps an active filter clearable when nothing is waiting', async () => {
    filters.load = () => of({ hidden: ['kgeestmann'], labels: [] });

    const element = await render(() => of(EMPTY), of(INSTALLED));

    expect(element.querySelector('app-filter-bar .clear')).not.toBeNull();
  });

  it('keeps the tabs but claims nothing is waiting when Hoot is installed nowhere', async () => {
    const element = await render(() => of(EMPTY), of(INSTALLED_NOWHERE));

    expect(element.querySelector('mat-tab-group')).not.toBeNull();
    expect(element.querySelector('.all-clear')).toBeNull();
  });

  it('still shows the overview when GitHub access cannot be loaded', async () => {
    const element = await render(
      () => of(OVERVIEW),
      throwError(() => new Error('502')),
    );

    expect(tabs(element)).toContain('Assigned 3');
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
    expect(text(element.querySelector('.retry'))).toBe('Try again');
  });

  it('loads again when retrying', async () => {
    const answers = [throwError(() => new HttpErrorResponse({ status: 502 })), of(OVERVIEW)];
    const element = await render(() => answers.shift()!, of(INSTALLED));

    element.querySelector<HTMLButtonElement>('.retry')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(tabs(element)).toContain('Assigned 3');
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

  describe('refreshing', () => {
    it('keeps the lists and the open tab while the new overview loads', async () => {
      const refreshed = new Subject<Overview>();
      const answers: Observable<Overview>[] = [of(OVERVIEW), refreshed];
      const element = await render(() => answers.shift()!, of(INSTALLED));
      await openTab(element, 'Mentions');

      element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click();
      await fixture.whenStable();

      expect(element.querySelector('mat-progress-bar')).not.toBeNull();
      expect(element.querySelector('[aria-busy]')).toBeNull();
      expect(rows(element)).toEqual(['Issue 6']);

      refreshed.next({
        ...OVERVIEW,
        mentions: [item('kgeestmann/hoot', 6), item('kgeestmann/hoot', 7)],
      });
      refreshed.complete();
      await fixture.whenStable();

      expect(element.querySelector('mat-progress-bar')).toBeNull();
      expect(selectedTab(element)).toBe('Mentions 2');
      expect(rows(element)).toEqual(['Issue 6', 'Issue 7']);
    });

    it('shows the refresh status in the filter row', async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      const toolbar = element.querySelector('.toolbar')!;
      expect(toolbar.querySelector('app-filter-bar')).not.toBeNull();
      expect(toolbar.querySelector('app-refresh-status')).not.toBeNull();
    });

    it('keeps the overview and says so when a refresh fails', async () => {
      const answers: Observable<Overview>[] = [
        of(OVERVIEW),
        throwError(() => new HttpErrorResponse({ status: 502 })),
      ];
      const element = await render(() => answers.shift()!, of(INSTALLED));

      element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click();
      await fixture.whenStable();

      expect(tabs(element)).toContain('Assigned 3');
      expect(text(element.querySelector('.updated'))).toContain("Couldn't refresh");
    });
  });

  describe('with filters', () => {
    it('applies the stored filters and says how much they hide', async () => {
      filters.load = () => of({ hidden: ['dipt-pa1469-ht26', 'kgeestmann/old-repo'], labels: [] });

      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(tabs(element)).toEqual([
        'My pull requests 0',
        'Review requests 0',
        'Assigned 1',
        'Mentions 1',
      ]);
      expect(text(element.querySelector('.summary'))).toBe('Showing 2 of 4 · 2 hidden');
    });

    it('hides an owner chosen in the Owner menu and saves that', async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Owner', 'dipt-pa1469-ht26');

      expect(tabs(element)).toContain('Assigned 2');
      expect(text(element.querySelector('.filter-button'))).toBe('Owner: 1 of 2');
      expect(filters.save).toHaveBeenCalledWith({ hidden: ['dipt-pa1469-ht26'], labels: [] });
    });

    it('hides a repository chosen in the Repository menu', async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Repository', 'kgeestmann/old-repo');

      expect(rows(element)).toEqual(['Issue 3', 'Issue 4']);
      expect(filters.save).toHaveBeenCalledWith({ hidden: ['kgeestmann/old-repo'], labels: [] });
    });

    it('shows only items with a label picked in the Label menu', async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Label', 'bug');

      expect(tabs(element)).toContain('Assigned 1');
      expect(rows(element)).toEqual(['Issue 4']);
      expect(filters.save).toHaveBeenCalledWith({ hidden: [], labels: ['bug'] });
    });

    it('says when everything in a tab is hidden by the filters', async () => {
      filters.load = () => of({ hidden: ['kgeestmann'], labels: [] });
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await openTab(element, 'Mentions');

      expect(text(element.querySelector('.empty'))).toBe('All 1 hidden by your filters.');
    });

    it('clears every filter at once', async () => {
      filters.load = () => of({ hidden: ['kgeestmann'], labels: ['bug'] });
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      element.querySelector<HTMLButtonElement>('.clear')!.click();
      await fixture.whenStable();

      expect(tabs(element)).toContain('Assigned 3');
      expect(element.querySelector('.clear')).toBeNull();
      expect(filters.save).toHaveBeenCalledWith(NO_FILTERS);
    });

    it('shows everything when the filters cannot be loaded', async () => {
      filters.load = () => throwError(() => new HttpErrorResponse({ status: 500 }));

      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(tabs(element)).toContain('Assigned 3');
    });

    it('warns when a filter change cannot be saved, but keeps applying it', async () => {
      filters.save = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Owner', 'dipt-pa1469-ht26');

      expect(element.querySelector('app-filter-bar [role="alert"]')).not.toBeNull();
      expect(tabs(element)).toContain('Assigned 2');
    });

    it('saves changes one after the other, so the last one is stored', async () => {
      const pending: Subject<OverviewFilters>[] = [];
      filters.save = vi.fn(() => {
        const save = new Subject<OverviewFilters>();
        pending.push(save);
        return save;
      });
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Owner', 'dipt-pa1469-ht26');
      await clickFilterOption(element, 'Label', 'bug');
      expect(filters.save).toHaveBeenCalledTimes(1);

      pending[0].next(NO_FILTERS);
      pending[0].complete();

      expect(filters.save).toHaveBeenLastCalledWith({
        hidden: ['dipt-pa1469-ht26'],
        labels: ['bug'],
      });
    });
  });
});
