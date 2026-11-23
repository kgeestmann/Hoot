import { inject, Injectable, signal } from '@angular/core';
import { catchError, concatMap, map, Observable, of, shareReplay, Subject, tap } from 'rxjs';

import {
  NO_FILTERS,
  OverviewFilters,
  OverviewFiltersService,
} from '../../../services/overview-filters';
import { toggleEntry } from './filtering';

/**
 * The user's filters, shared by the overview and the list pages: a change on one page shows on
 * the others, and every change is saved, one after the other, so the last one is what stays.
 */
@Injectable({
  providedIn: 'root',
})
export class FilterState {
  private readonly api = inject(OverviewFiltersService);
  private readonly saves = new Subject<OverviewFilters>();
  private loading?: Observable<OverviewFilters>;

  readonly filters = signal<OverviewFilters>(NO_FILTERS);
  readonly saveFailed = signal(false);

  constructor() {
    this.saves
      .pipe(
        concatMap((filters) =>
          this.api.save(filters).pipe(
            map(() => true),
            catchError(() => of(false)),
          ),
        ),
      )
      .subscribe((saved) => this.saveFailed.set(!saved));
  }

  /** Load the stored filters once; if that fails, everything shows and the next call asks again. */
  load(): Observable<OverviewFilters> {
    this.loading ??= this.api.load().pipe(
      tap((filters) => this.filters.set(filters)),
      catchError(() => {
        this.loading = undefined;
        return of(NO_FILTERS);
      }),
      shareReplay(1),
    );
    return this.loading;
  }

  /** Show a hidden owner or repository again, or hide a shown one. */
  toggleScope(scope: string): void {
    this.save({ ...this.filters(), hidden: toggleEntry(this.filters().hidden, scope) });
  }

  /** Pick a label to show only items carrying it, or unpick it. */
  toggleLabel(label: string): void {
    this.save({ ...this.filters(), labels: toggleEntry(this.filters().labels, label) });
  }

  clear(): void {
    this.save(NO_FILTERS);
  }

  private save(filters: OverviewFilters): void {
    this.filters.set(filters);
    this.saves.next(filters);
  }
}
