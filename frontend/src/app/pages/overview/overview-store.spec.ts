import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';

import { Overview, OverviewService } from '../../services/overview';
import { OverviewStore } from './overview-store';

const ALL_LOADED = { total: 0, has_more: false, search_url: '' };
const EMPTY: Overview = {
  pull_requests: [],
  review_requests: [],
  assigned_issues: [],
  mentions: [],
  totals: {
    pull_requests: ALL_LOADED,
    review_requests: ALL_LOADED,
    assigned_issues: ALL_LOADED,
    mentions: ALL_LOADED,
  },
};

describe('OverviewStore', () => {
  let requests: number;

  function setUp(answers: Observable<Overview>[]): OverviewStore {
    requests = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OverviewService,
          useValue: {
            load: () => {
              requests++;
              return answers.shift()!;
            },
          },
        },
      ],
    });
    return TestBed.inject(OverviewStore);
  }

  it('asks GitHub once and shares the overview', () => {
    const store = setUp([of(EMPTY)]);

    store.load().subscribe();
    store.load().subscribe();

    expect(requests).toBe(1);
    expect(store.overview()).toEqual(EMPTY);
  });

  it('asks again after a failed load', () => {
    const store = setUp([throwError(() => new Error('502')), of(EMPTY)]);

    store.load().subscribe({ error: () => undefined });
    store.load().subscribe();

    expect(requests).toBe(2);
    expect(store.overview()).toEqual(EMPTY);
  });

  it('keeps the current overview while a reload runs, then replaces it', () => {
    const reloaded = new Subject<Overview>();
    const store = setUp([of(EMPTY), reloaded]);
    store.load().subscribe();
    const updated: Overview = { ...EMPTY, mentions: [] };

    store.reload().subscribe();
    expect(store.overview()).toBe(EMPTY);
    reloaded.next(updated);

    expect(store.overview()).toBe(updated);
  });
});
