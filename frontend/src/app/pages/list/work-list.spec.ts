import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { ItemState, ItemStatesService } from '../../services/item-states';

import { ListName, ListPage, ListSort, ListsService } from '../../services/lists';
import { OverviewItem } from '../../services/overview';
import {
  NO_FILTERS,
  OverviewFilters,
  OverviewFiltersService,
} from '../../services/overview-filters';
import { LIST_PAGES } from './list-pages';
import { groupByRepository, WorkList } from './work-list';

const ASSIGNED = LIST_PAGES.find((page) => page.list === 'assigned_issues')!;

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

function page(items: OverviewItem[], options: Partial<ListPage> = {}): ListPage {
  return {
    items,
    total: items.length,
    has_more: false,
    end_cursor: null,
    search_url: 'https://github.com/search?q=x&type=issues',
    ...options,
  };
}

type LoadCall = [ListName, ListSort, string | undefined];

function storedStates(states: ItemState[]): void {
  TestBed.configureTestingModule({
    providers: [{ provide: ItemStatesService, useValue: { load: () => of(states) } }],
  });
}

describe('WorkList', () => {
  let fixture: ComponentFixture<WorkList>;
  let calls: LoadCall[];
  let filters: {
    load: () => Observable<OverviewFilters>;
    save: (saved: OverviewFilters) => Observable<OverviewFilters>;
  };

  async function render(answers: Observable<ListPage>[]) {
    calls = [];
    filters = { load: () => of(NO_FILTERS), save: (saved) => of(saved) };
    await TestBed.configureTestingModule({
      imports: [WorkList],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { page: ASSIGNED } } } },
        {
          provide: ListsService,
          useValue: {
            load: (list: ListName, sort: ListSort, after?: string) => {
              calls.push([list, sort, after]);
              return answers.shift()!;
            },
          },
        },
        { provide: OverviewFiltersService, useValue: filters },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkList);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function rows(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.panel .title')).map(text);
  }

  async function click(element: HTMLElement | null): Promise<void> {
    element!.click();
    await fixture.whenStable();
  }

  it('shows a skeleton without tabs while loading', async () => {
    const element = await render([NEVER]);

    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(element.querySelector('.skeleton-tabs')).toBeNull();
  });

  it("loads the page's list, newest activity first", async () => {
    const element = await render([of(page([item('octo/hoot', 1), item('octo/hoot', 2)]))]);

    expect(calls).toEqual([['assigned_issues', 'updated', undefined]]);
    expect(rows(element)).toEqual(['Issue 1', 'Issue 2']);
    expect(text(element.querySelector('.total'))).toBe('2 on GitHub');
  });

  it("shows the list's empty text", async () => {
    const element = await render([of(page([]))]);

    expect(text(element.querySelector('.empty'))).toBe(ASSIGNED.emptyText);
    expect(element.querySelector('app-filter-bar')).toBeNull();
  });

  it('loads more after the last cursor and appends the items', async () => {
    const element = await render([
      of(page([item('octo/hoot', 1)], { total: 2, has_more: true, end_cursor: 'Y3Vyc29yOjE=' })),
      of(page([item('octo/hoot', 2)], { total: 2 })),
    ]);
    expect(text(element.querySelector('.loaded'))).toBe('Loaded 1 of 2');

    await click(element.querySelector<HTMLButtonElement>('.load-more'));

    expect(calls[1]).toEqual(['assigned_issues', 'updated', 'Y3Vyc29yOjE=']);
    expect(rows(element)).toEqual(['Issue 1', 'Issue 2']);
    expect(element.querySelector('.load-more')).toBeNull();
  });

  it('keeps the loaded items and says so when loading more fails', async () => {
    const element = await render([
      of(page([item('octo/hoot', 1)], { total: 2, has_more: true, end_cursor: 'Y3Vyc29yOjE=' })),
      throwError(() => new HttpErrorResponse({ status: 502 })),
    ]);

    await click(element.querySelector<HTMLButtonElement>('.load-more'));

    expect(rows(element)).toEqual(['Issue 1']);
    expect(text(element.querySelector('.load-more-error'))).toBe("Couldn't load more. Try again.");
  });

  it('reloads from the start in the order picked in the sort menu', async () => {
    const element = await render([
      of(page([item('octo/hoot', 1), item('octo/hoot', 2)])),
      of(page([item('octo/hoot', 2), item('octo/hoot', 1)])),
    ]);

    await click(element.querySelector<HTMLButtonElement>('.sort-button'));
    const oldest = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    ).find((option) => text(option) === 'Oldest first');
    await click(oldest!);

    expect(calls[1]).toEqual(['assigned_issues', 'oldest', undefined]);
    expect(rows(element)).toEqual(['Issue 2', 'Issue 1']);
    expect(text(element.querySelector('.sort-button'))).toBe('Sort: Oldest first');
  });

  it('keeps the items visible while a new order loads', async () => {
    const reordered = new Subject<ListPage>();
    const element = await render([of(page([item('octo/hoot', 1)])), reordered]);

    fixture.componentInstance.changeSort('created');
    await fixture.whenStable();

    expect(rows(element)).toEqual(['Issue 1']);
    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('drops an answer that arrives after a newer request', async () => {
    const slow = new Subject<ListPage>();
    const element = await render([
      of(page([item('octo/hoot', 1)])),
      slow,
      of(page([item('octo/hoot', 3)])),
    ]);

    fixture.componentInstance.changeSort('oldest');
    fixture.componentInstance.changeSort('created');
    await fixture.whenStable();
    slow.next(page([item('octo/hoot', 2)]));
    slow.complete();
    await fixture.whenStable();

    expect(rows(element)).toEqual(['Issue 3']);
  });

  it('groups the items by repository when switched on', async () => {
    const element = await render([
      of(page([item('octo/zoo', 1), item('octo/hoot', 2), item('octo/zoo', 3)])),
    ]);

    await click(element.querySelector<HTMLElement>('.group-toggle button'));

    const headings = Array.from(element.querySelectorAll('.group-heading')).map(text);
    expect(headings).toEqual(['octo/hoot 1', 'octo/zoo 2']);
  });

  it('leaves out what the user marked as done', async () => {
    storedStates([
      {
        url: 'https://github.com/octo/hoot/issues/1',
        done_at: '2099-01-01T00:00:00Z',
        snoozed_until: null,
      },
    ]);
    const element = await render([of(page([item('octo/hoot', 1), item('octo/hoot', 2)]))]);

    expect(rows(element)).toEqual(['Issue 2']);
  });

  it('applies the shared filters', async () => {
    const element = await render([of(page([item('octo/hoot', 1, ['bug']), item('octo/hoot', 2)]))]);

    fixture.componentInstance.filterState.toggleLabel('bug');
    await fixture.whenStable();

    expect(rows(element)).toEqual(['Issue 1']);
    expect(text(element.querySelector('.summary'))).toBe('Showing 1 of 2 · 1 hidden');
  });

  it('offers a retry when the first page cannot be loaded', async () => {
    const element = await render([
      throwError(() => new HttpErrorResponse({ status: 502 })),
      of(page([item('octo/hoot', 1)])),
    ]);

    await click(element.querySelector<HTMLButtonElement>('.retry'));

    expect(rows(element)).toEqual(['Issue 1']);
  });
});

describe('groupByRepository', () => {
  it('groups by repository, sorted by name, keeping the order within a group', () => {
    const groups = groupByRepository([
      item('Octo/Zoo', 1),
      item('octo/hoot', 2),
      item('octo/zoo', 3),
    ]);

    expect(groups.map((group) => [group.repository, group.items.map((i) => i.number)])).toEqual([
      ['octo/hoot', [2]],
      ['Octo/Zoo', [1, 3]],
    ]);
  });
});
