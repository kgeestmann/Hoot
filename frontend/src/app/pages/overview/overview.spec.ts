import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { ItemState, ItemStatesService } from '../../services/item-states';

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
    comment_count: 0,
    milestone: null,
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

/** Four assigned issues in two owners, one with the label "bug", and one mention. */
const OVERVIEW: Overview = {
  ...EMPTY,
  assigned_issues: [
    item('dipt-pa1469-ht26/team-14', 3),
    item('kgeestmann/hoot', 4, ['bug']),
    item('kgeestmann/old-repo', 5),
    item('kgeestmann/hoot', 7),
  ],
  mentions: [item('kgeestmann/hoot', 6)],
};

function storedStates(states: ItemState[]): void {
  TestBed.configureTestingModule({
    providers: [{ provide: ItemStatesService, useValue: { load: () => of(states) } }],
  });
}

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
        provideRouter([]),
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

  /** Each card as "Name count", e.g. "Assigned issues 4". */
  function cards(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.summary-card')).map(
      (card) =>
        `${text(card.querySelector('.card-name'))} ${text(card.querySelector('.card-count'))}`,
    );
  }

  /** The titles in the latest activity, newest first. */
  function feed(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.feed .item-title')).map(text);
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

  it('shows one card per list with its count', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(cards(element)).toEqual([
      'Pull requests 0',
      'Review requests 0',
      'Assigned issues 4',
      'Mentions 1',
    ]);
  });

  it('leaves out what the user marked as done or snoozed, with actions on each row', async () => {
    storedStates([
      {
        url: 'https://github.com/dipt-pa1469-ht26/team-14/issues/3',
        done_at: '2099-01-01T00:00:00Z',
        snoozed_until: null,
      },
      {
        url: 'https://github.com/kgeestmann/hoot/issues/6',
        done_at: null,
        snoozed_until: '2099-01-01T00:00:00Z',
      },
    ]);
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(cards(element)).toEqual([
      'Pull requests 0',
      'Review requests 0',
      'Assigned issues 3',
      'Mentions 0',
    ]);
    expect(feed(element)).toEqual(['Issue 4', 'Issue 5', 'Issue 7']);
    expect(element.querySelectorAll('.feed app-item-actions').length).toBe(3);
  });

  it('shows the latest activity across all lists, saying where each item comes from', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(feed(element)).toEqual(['Issue 3', 'Issue 4', 'Issue 5', 'Issue 7', 'Issue 6']);
    expect(Array.from(element.querySelectorAll('.feed .from')).map(text)).toEqual([
      'Assigned to you',
      'Assigned to you',
      'Assigned to you',
      'Assigned to you',
      'Mention',
    ]);
    expect(element.querySelector<HTMLAnchorElement>('.feed a.card-item')?.href).toBe(
      'https://github.com/dipt-pa1469-ht26/team-14/issues/3',
    );
  });

  it("links each tile to its list's own page", async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(
      Array.from(element.querySelectorAll('a.tile')).map((link) => link.getAttribute('href')),
    ).toEqual(['/pull-requests', '/review-requests', '/assigned', '/mentions']);
  });

  it('marks a count with "+" when GitHub cut the list off', async () => {
    const element = await render(
      () =>
        of({
          ...OVERVIEW,
          totals: { ...NO_MORE, assigned_issues: { total: 70, has_more: true, search_url: '' } },
        }),
      of(INSTALLED),
    );

    expect(cards(element)).toContain('Assigned issues 4+');
  });

  it('leaves GitHub access to its own page', async () => {
    const element = await render(() => of(OVERVIEW), of(INSTALLED));

    expect(element.querySelector('app-github-access')).toBeNull();
  });

  it('says so when nothing is waiting, and keeps the cards', async () => {
    const element = await render(() => of(EMPTY), of(INSTALLED));

    expect(element.querySelector('.all-clear')?.textContent).toContain('Nothing waiting on you');
    expect(element.querySelector('.all-clear mat-icon')?.getAttribute('data-mat-icon-name')).toBe(
      'task_alt',
    );
    expect(cards(element)).toEqual([
      'Pull requests 0',
      'Review requests 0',
      'Assigned issues 0',
      'Mentions 0',
    ]);
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

  it('keeps the cards but claims nothing is waiting when Hoot is installed nowhere', async () => {
    const element = await render(() => of(EMPTY), of(INSTALLED_NOWHERE));

    expect(element.querySelectorAll('.summary-card').length).toBe(4);
    expect(element.querySelector('.all-clear')).toBeNull();
  });

  it('still shows the overview when GitHub access cannot be loaded', async () => {
    const element = await render(
      () => of(OVERVIEW),
      throwError(() => new Error('502')),
    );

    expect(cards(element)).toContain('Assigned issues 4');
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
    expect(cards(element)).toContain('Assigned issues 4');
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
    it('keeps the cards while the new overview loads', async () => {
      const refreshed = new Subject<Overview>();
      const answers: Observable<Overview>[] = [of(OVERVIEW), refreshed];
      const element = await render(() => answers.shift()!, of(INSTALLED));

      element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click();
      await fixture.whenStable();

      expect(element.querySelector('mat-progress-bar')).not.toBeNull();
      expect(cards(element)).toContain('Mentions 1');

      refreshed.next({
        ...OVERVIEW,
        mentions: [item('kgeestmann/hoot', 6), item('kgeestmann/hoot', 8)],
      });
      refreshed.complete();
      await fixture.whenStable();

      expect(element.querySelector('mat-progress-bar')).toBeNull();
      expect(cards(element)).toContain('Mentions 2');
    });

    it("shows the refresh status in the filter header's status row", async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(element.querySelector('app-filter-bar .status app-refresh-status')).not.toBeNull();
      expect(element.querySelectorAll('app-refresh-status')).toHaveLength(1);
    });

    it('keeps the overview and says so when a refresh fails', async () => {
      const answers: Observable<Overview>[] = [
        of(OVERVIEW),
        throwError(() => new HttpErrorResponse({ status: 502 })),
      ];
      const element = await render(() => answers.shift()!, of(INSTALLED));

      element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click();
      await fixture.whenStable();

      expect(cards(element)).toContain('Assigned issues 4');
      expect(text(element.querySelector('.updated'))).toContain("Couldn't refresh");
    });
  });

  describe('with filters', () => {
    it('applies the stored filters to the cards and says how much they hide', async () => {
      filters.load = () => of({ hidden: ['dipt-pa1469-ht26', 'kgeestmann/old-repo'], labels: [] });

      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(cards(element)).toContain('Assigned issues 2');
      expect(feed(element)).toEqual(['Issue 4', 'Issue 7', 'Issue 6']);
      expect(text(element.querySelector('.summary'))).toBe('Showing 3 of 5 · 2 hidden');
    });

    it('hides an owner chosen in the Owner menu and saves that', async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Owner', 'dipt-pa1469-ht26');

      expect(cards(element)).toContain('Assigned issues 3');
      expect(filters.save).toHaveBeenCalledWith({ hidden: ['dipt-pa1469-ht26'], labels: [] });
    });

    it('shows only items with a label picked in the Label menu', async () => {
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Label', 'bug');

      expect(feed(element)).toEqual(['Issue 4']);
      expect(filters.save).toHaveBeenCalledWith({ hidden: [], labels: ['bug'] });
    });

    it('says when the filters hide everything that is waiting', async () => {
      filters.load = () => of({ hidden: ['kgeestmann', 'dipt-pa1469-ht26'], labels: [] });

      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(feed(element)).toEqual([]);
      expect(text(element.querySelector('.feed .empty'))).toBe(
        'Your filters hide everything that is waiting.',
      );
    });

    it('clears every filter at once', async () => {
      filters.load = () => of({ hidden: ['kgeestmann'], labels: ['bug'] });
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      element.querySelector<HTMLButtonElement>('.clear')!.click();
      await fixture.whenStable();

      expect(cards(element)).toContain('Assigned issues 4');
      expect(filters.save).toHaveBeenCalledWith(NO_FILTERS);
    });

    it('shows everything when the filters cannot be loaded', async () => {
      filters.load = () => throwError(() => new HttpErrorResponse({ status: 500 }));

      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      expect(cards(element)).toContain('Assigned issues 4');
    });

    it('warns when a filter change cannot be saved, but keeps applying it', async () => {
      filters.save = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
      const element = await render(() => of(OVERVIEW), of(INSTALLED));

      await clickFilterOption(element, 'Owner', 'dipt-pa1469-ht26');

      expect(element.querySelector('app-filter-bar [role="alert"]')).not.toBeNull();
      expect(cards(element)).toContain('Assigned issues 3');
    });
  });
});
