import { inject, Injectable, signal } from '@angular/core';
import { catchError, concatMap, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';

import { ItemState, ItemStatesService } from '../../../services/item-states';
import { Overview, OverviewItem } from '../../../services/overview';

/** Whether a done or snoozed state still hides the item at `now`. */
export function isSettled(item: OverviewItem, state: ItemState | undefined, now: Date): boolean {
  if (!state) {
    return false;
  }
  if (state.done_at) {
    return new Date(item.updated_at) <= new Date(state.done_at);
  }
  return !!state.snoozed_until && now < new Date(state.snoozed_until);
}

/** The items no done or snoozed state hides. */
export function withoutSettled<T extends OverviewItem>(
  items: readonly T[],
  states: ReadonlyMap<string, ItemState>,
  now: Date,
): T[] {
  return items.filter((item) => !isSettled(item, states.get(item.url), now));
}

/** The overview with every done or snoozed item left out. */
export function overviewWithoutSettled(
  overview: Overview,
  states: ReadonlyMap<string, ItemState>,
  now: Date,
): Overview {
  return {
    ...overview,
    pull_requests: withoutSettled(overview.pull_requests, states, now),
    review_requests: withoutSettled(overview.review_requests, states, now),
    assigned_issues: withoutSettled(overview.assigned_issues, states, now),
    mentions: withoutSettled(overview.mentions, states, now),
  };
}

/**
 * The items the user marked as done or snoozed, shared by the overview, the sidebar counts and the
 * list pages. A change shows at once and is saved in the background, one after the other; if
 * saving fails, the change is taken back.
 */
@Injectable({
  providedIn: 'root',
})
export class ItemStateStore {
  private readonly api = inject(ItemStatesService);
  private loading?: Observable<void>;
  private queue: Observable<unknown> = of(undefined);

  readonly states = signal<ReadonlyMap<string, ItemState>>(new Map());

  /** Load the stored states once; if that fails, nothing is hidden and the next call asks again. */
  load(): Observable<void> {
    this.loading ??= this.api.load().pipe(
      tap((states) => this.states.set(new Map(states.map((state) => [state.url, state])))),
      map(() => undefined),
      catchError(() => {
        this.loading = undefined;
        return of(undefined);
      }),
      shareReplay(1),
    );
    return this.loading;
  }

  /** Hide the item until GitHub updates it again. */
  markDone(item: OverviewItem): Observable<void> {
    const state = { url: item.url, done_at: new Date().toISOString(), snoozed_until: null };
    return this.change(item.url, state, () => this.api.markDone(item.url));
  }

  /** Hide the item until `until`. */
  snooze(item: OverviewItem, until: Date): Observable<void> {
    const state = { url: item.url, done_at: null, snoozed_until: until.toISOString() };
    return this.change(item.url, state, () => this.api.snooze(item.url, until));
  }

  /** Show the item again. */
  restore(item: OverviewItem): Observable<void> {
    return this.change(item.url, undefined, () =>
      this.api.forget(item.url).pipe(map(() => undefined)),
    );
  }

  /** Apply `state` at once, save it after the earlier changes, and take it back if saving fails. */
  private change(
    url: string,
    state: ItemState | undefined,
    save: () => Observable<ItemState | undefined>,
  ): Observable<void> {
    const before = this.states().get(url);
    this.put(url, state);
    const saving = this.queue.pipe(
      // Each queued change emits once; an earlier failure doesn't stop the next one.
      catchError(() => of(undefined)),
      concatMap(save),
      tap((saved) => this.put(url, saved ?? undefined)),
      map(() => undefined),
      catchError((error: unknown) => {
        this.put(url, before);
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    this.queue = saving;
    saving.subscribe({ error: () => undefined });
    return saving;
  }

  private put(url: string, state: ItemState | undefined): void {
    const states = new Map(this.states());
    if (state) {
      states.set(url, state);
    } else {
      states.delete(url);
    }
    this.states.set(states);
  }
}
