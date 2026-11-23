import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ItemState, ItemStatesService } from '../../../services/item-states';
import { Overview, OverviewItem } from '../../../services/overview';
import {
  isSettled,
  ItemStateStore,
  nextSnoozeEnd,
  overviewWithoutSettled,
} from './item-state-store';

const NOW = new Date('2026-11-23T12:00:00Z');

function item(number: number, updatedAt = '2026-11-22T10:00:00Z'): OverviewItem {
  return {
    kind: 'issue',
    title: `Issue ${number}`,
    repository: 'octo/hoot',
    number,
    url: `https://github.com/octo/hoot/issues/${number}`,
    updated_at: updatedAt,
    labels: [],
    comment_count: 0,
    milestone: null,
  };
}

function done(url: string, at: string): ItemState {
  return { url, done_at: at, snoozed_until: null };
}

function snoozed(url: string, until: string): ItemState {
  return { url, done_at: null, snoozed_until: until };
}

describe('isSettled', () => {
  it('hides a done item until GitHub updates it again', () => {
    const issue = item(1, '2026-11-22T10:00:00Z');

    expect(isSettled(issue, done(issue.url, '2026-11-22T11:00:00Z'), NOW)).toBe(true);
    expect(isSettled(issue, done(issue.url, '2026-11-22T09:00:00Z'), NOW)).toBe(false);
  });

  it('hides a snoozed item until the snooze ends', () => {
    const issue = item(1);

    expect(isSettled(issue, snoozed(issue.url, '2026-11-24T09:00:00Z'), NOW)).toBe(true);
    expect(isSettled(issue, snoozed(issue.url, '2026-11-23T09:00:00Z'), NOW)).toBe(false);
  });

  it('shows items without a state', () => {
    expect(isSettled(item(1), undefined, NOW)).toBe(false);
  });
});

describe('nextSnoozeEnd', () => {
  it('finds the earliest snooze still ahead', () => {
    const states = new Map([
      ['a', snoozed('a', '2026-11-25T09:00:00Z')],
      ['b', snoozed('b', '2026-11-23T15:00:00Z')],
      ['c', snoozed('c', '2026-11-23T09:00:00Z')],
      ['d', done('d', '2026-11-23T00:00:00Z')],
    ]);

    expect(nextSnoozeEnd(states, NOW)).toEqual(new Date('2026-11-23T15:00:00Z'));
    expect(nextSnoozeEnd(new Map(), NOW)).toBeUndefined();
  });
});

describe('overviewWithoutSettled', () => {
  it('leaves settled items out of every list and keeps the totals', () => {
    const [kept, settled] = [item(1), item(2)];
    const allLoaded = { total: 2, has_more: false, search_url: '' };
    const overview: Overview = {
      pull_requests: [],
      review_requests: [],
      assigned_issues: [kept, settled],
      mentions: [settled],
      totals: {
        pull_requests: allLoaded,
        review_requests: allLoaded,
        assigned_issues: allLoaded,
        mentions: allLoaded,
      },
    };
    const states = new Map([[settled.url, done(settled.url, '2026-11-23T00:00:00Z')]]);

    const waiting = overviewWithoutSettled(overview, states, NOW);

    expect(waiting.assigned_issues).toEqual([kept]);
    expect(waiting.mentions).toEqual([]);
    expect(waiting.totals).toBe(overview.totals);
  });
});

type FakeApi = Partial<Record<keyof ItemStatesService, (...args: never[]) => Observable<unknown>>>;

describe('ItemStateStore', () => {
  let calls: string[];

  function setUp(api: FakeApi): ItemStateStore {
    calls = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ItemStatesService,
          useValue: {
            load: () => of([]),
            markDone: (url: string) => of(done(url, '2026-11-23T12:00:00Z')),
            snooze: (url: string, until: Date) => of(snoozed(url, until.toISOString())),
            forget: () => of(undefined),
            ...api,
          },
        },
      ],
    });
    return TestBed.inject(ItemStateStore);
  }

  it('loads the stored states once', () => {
    let loads = 0;
    const store = setUp({
      load: () => {
        loads++;
        return of([done(item(1).url, '2026-11-23T00:00:00Z')]);
      },
    });

    store.load().subscribe();
    store.load().subscribe();

    expect(loads).toBe(1);
    expect([...store.states().keys()]).toEqual([item(1).url]);
  });

  it('shows a change at once and keeps what the backend stored', () => {
    const saved = new Subject<ItemState>();
    const store = setUp({ markDone: () => saved });

    store.markDone(item(1)).subscribe();
    expect(store.states().get(item(1).url)?.done_at).toBeTruthy();
    saved.next(done(item(1).url, '2026-11-23T12:00:05Z'));
    saved.complete();

    expect(store.states().get(item(1).url)?.done_at).toBe('2026-11-23T12:00:05Z');
  });

  it('takes a change back when saving it fails', () => {
    const store = setUp({ markDone: () => throwError(() => new Error('502')) });
    let failed = false;

    store.markDone(item(1)).subscribe({ error: () => (failed = true) });

    expect(failed).toBe(true);
    expect(store.states().has(item(1).url)).toBe(false);
  });

  it('saves changes one after the other, so an undo follows its change', () => {
    const marking = new Subject<ItemState>();
    const store = setUp({
      markDone: (url: string) => {
        calls.push(`put ${url}`);
        return marking;
      },
      forget: (url: string) => {
        calls.push(`delete ${url}`);
        return of(undefined);
      },
    });

    store.markDone(item(1));
    store.restore(item(1));
    expect(calls).toEqual([`put ${item(1).url}`]);
    marking.next(done(item(1).url, '2026-11-23T12:00:00Z'));
    marking.complete();

    expect(calls).toEqual([`put ${item(1).url}`, `delete ${item(1).url}`]);
    expect(store.states().has(item(1).url)).toBe(false);
  });

  it('does not send a failed change again to a later subscriber', () => {
    let requests = 0;
    const store = setUp({
      markDone: () => {
        requests++;
        return throwError(() => new Error('502'));
      },
    });
    const saving = store.markDone(item(1));
    let failed = false;

    saving.subscribe({ error: () => (failed = true) });

    expect(failed).toBe(true);
    expect(requests).toBe(1);
  });

  it('shows a snoozed item again once its snooze ends', () => {
    vi.useFakeTimers({ now: NOW });
    try {
      const store = setUp({});
      const issue = item(1);
      store.snooze(issue, new Date(NOW.getTime() + 60_000)).subscribe();
      TestBed.tick();
      expect(isSettled(issue, store.states().get(issue.url), store.now())).toBe(true);

      vi.advanceTimersByTime(61_000);
      TestBed.tick();

      expect(isSettled(issue, store.states().get(issue.url), store.now())).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps saving after an earlier change failed', () => {
    const store = setUp({
      markDone: () => throwError(() => new Error('502')),
      snooze: (url: string, until: Date) => of(snoozed(url, until.toISOString())),
    });

    store.markDone(item(1)).subscribe({ error: () => undefined });
    store.snooze(item(2), new Date('2026-11-24T09:00:00Z')).subscribe();

    expect(store.states().get(item(2).url)?.snoozed_until).toBe('2026-11-24T09:00:00.000Z');
  });
});
