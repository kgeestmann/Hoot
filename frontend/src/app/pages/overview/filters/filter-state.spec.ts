import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';

import {
  NO_FILTERS,
  OverviewFilters,
  OverviewFiltersService,
} from '../../../services/overview-filters';
import { FilterState } from './filter-state';

describe('FilterState', () => {
  let loads: number;
  let saved: OverviewFilters[];

  function setUp(
    load: () => Observable<OverviewFilters>,
    save: (filters: OverviewFilters) => Observable<OverviewFilters> = (filters) => of(filters),
  ): FilterState {
    loads = 0;
    saved = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OverviewFiltersService,
          useValue: {
            load: () => {
              loads++;
              return load();
            },
            save: (filters: OverviewFilters) => {
              saved.push(filters);
              return save(filters);
            },
          },
        },
      ],
    });
    return TestBed.inject(FilterState);
  }

  it('loads the stored filters once for every page', () => {
    const state = setUp(() => of({ hidden: ['octo-org'], labels: [] }));

    state.load().subscribe();
    state.load().subscribe();

    expect(loads).toBe(1);
    expect(state.filters()).toEqual({ hidden: ['octo-org'], labels: [] });
  });

  it('shows everything and asks again after a failed load', () => {
    const state = setUp(() => throwError(() => new Error('500')));
    let loaded: OverviewFilters | undefined;

    state.load().subscribe((filters) => (loaded = filters));
    state.load().subscribe();

    expect(loaded).toEqual(NO_FILTERS);
    expect(loads).toBe(2);
  });

  it('changes and saves the filters', () => {
    const state = setUp(() => of(NO_FILTERS));

    state.toggleScope('octo-org');
    state.toggleLabel('bug');
    state.clear();

    expect(saved).toEqual([
      { hidden: ['octo-org'], labels: [] },
      { hidden: ['octo-org'], labels: ['bug'] },
      NO_FILTERS,
    ]);
    expect(state.filters()).toEqual(NO_FILTERS);
  });

  it('saves one change after the other and reports a failed save', () => {
    const pending: Subject<OverviewFilters>[] = [];
    const state = setUp(
      () => of(NO_FILTERS),
      () => {
        const save = new Subject<OverviewFilters>();
        pending.push(save);
        return save;
      },
    );

    state.toggleScope('octo-org');
    state.toggleScope('kgeestmann');
    expect(saved.length).toBe(1);

    pending[0].error(new Error('500'));

    expect(state.saveFailed()).toBe(true);
    expect(saved.length).toBe(2);
  });
});
