import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import { LoadError, loadErrorMessage } from '../../layout/load-error/load-error';
import { ListSkeleton } from '../../layout/list-skeleton/list-skeleton';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { FilterBar } from './filters/filter-bar';
import { FilterState } from './filters/filter-state';
import { applyFilters, countItems, filterOptions } from './filters/filtering';
import { ItemActions } from './item-state/item-actions';
import { ItemStateStore, overviewWithoutSettled } from './item-state/item-state-store';
import { ItemMeta } from './item/item-meta';
import { OverviewStore } from './overview-store';
import { RefreshStatus } from './refresh-status/refresh-status';
import { summarize } from './summary';

/**
 * The start page: a dashboard with one card per list (count, newest items, link to the list's
 * own page), with the shared filters applied.
 */
@Component({
  selector: 'app-overview-page',
  imports: [
    FilterBar,
    ItemActions,
    ItemMeta,
    ListSkeleton,
    LoadError,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    RefreshStatus,
    RouterLink,
  ],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview.css',
})
export class OverviewPage implements OnInit {
  private readonly store = inject(OverviewStore);
  private readonly gitHubAccessService = inject(GitHubAccessService);
  /** The user's filters, shared with the list pages. */
  readonly filterState = inject(FilterState);

  private readonly itemStates = inject(ItemStateStore);

  /** The shared overview; `undefined` until it first arrived. */
  readonly overview = this.store.overview;
  /** The overview without the items the user marked as done or snoozed. */
  readonly waiting = computed(() => {
    const overview = this.overview();
    return (
      overview && overviewWithoutSettled(overview, this.itemStates.states(), this.itemStates.now())
    );
  });
  readonly loadError = signal<string | undefined>(undefined);
  /** `undefined` until loaded; the page works without it. */
  readonly access = signal<GitHubAccess | undefined>(undefined);
  readonly filters = this.filterState.filters;
  /** When the shown overview came from GitHub. */
  readonly loadedAt = signal(new Date());
  readonly refreshing = signal(false);
  readonly refreshFailed = signal(false);

  readonly totalCount = computed(() => {
    const overview = this.waiting();
    return overview ? countItems(overview) : 0;
  });
  readonly shownCount = computed(() => {
    const overview = this.waiting();
    return overview ? countItems(applyFilters(overview, this.filters())) : 0;
  });
  readonly filterOptions = computed(() => {
    const overview = this.waiting();
    return overview ? filterOptions(overview, this.filters()) : { owners: [], labels: [] };
  });
  readonly cards = computed(() => {
    const overview = this.waiting();
    return overview ? summarize(overview, this.filters()) : [];
  });

  /** Without any installation every list is empty for that reason; the layout's banner explains it. */
  readonly installedNowhere = computed(() => this.access()?.installations.length === 0);
  readonly nothingWaiting = computed(() => !!this.overview() && this.totalCount() === 0);
  /** Without items the filter menus would be empty; an active filter stays clearable. */
  readonly showFilters = computed(() => {
    const filters = this.filters();
    return this.totalCount() > 0 || filters.hidden.length > 0 || filters.labels.length > 0;
  });

  ngOnInit(): void {
    this.load();
  }

  /** Load the overview (shared with the sidebar) with the user's filters, e.g. after an error. */
  load(): void {
    this.loadError.set(undefined);
    forkJoin({
      overview: this.store.load(),
      // Without stored filters the overview is still useful, just unfiltered.
      filters: this.filterState.load(),
      // Without the stored states nothing is hidden; the overview is still useful.
      itemStates: this.itemStates.load(),
    }).subscribe({
      next: () => this.loadedAt.set(new Date()),
      error: (error: unknown) => this.loadError.set(loadErrorMessage(error)),
    });
    this.gitHubAccessService.load().subscribe({
      next: (access) => this.access.set(access),
      error: () => this.access.set(undefined),
    });
  }

  /** Load the overview again while the current one stays visible; on failure it stays as it is. */
  refresh(): void {
    if (this.refreshing()) {
      return;
    }
    this.refreshing.set(true);
    this.store
      .reload()
      .pipe(finalize(() => this.refreshing.set(false)))
      .subscribe({
        next: () => {
          this.loadedAt.set(new Date());
          this.refreshFailed.set(false);
        },
        error: () => this.refreshFailed.set(true),
      });
  }
}
