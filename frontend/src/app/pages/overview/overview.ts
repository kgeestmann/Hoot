import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { finalize, forkJoin } from 'rxjs';

import { LoadError, loadErrorMessage } from '../../layout/load-error/load-error';
import { ListSkeleton } from '../../layout/list-skeleton/list-skeleton';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewService } from '../../services/overview';
import { FilterBar } from './filters/filter-bar';
import { FilterState } from './filters/filter-state';
import { applyFilters, countItems, filterOptions } from './filters/filtering';
import { firstTabWithItems, ListTab, ListTabs } from './list-tabs/list-tabs';
import { RefreshStatus } from './refresh-status/refresh-status';

/** The four tabs, in order: which list each shows and what it says when the list is empty. */
const TABS = [
  {
    section: 'pull_requests',
    label: 'My pull requests',
    emptyText: 'You have no open pull requests.',
  },
  {
    section: 'review_requests',
    label: 'Review requests',
    emptyText: 'No reviews are waiting on you.',
  },
  {
    section: 'assigned_issues',
    label: 'Assigned',
    emptyText: 'No open issues are assigned to you.',
  },
  {
    section: 'mentions',
    label: 'Mentions',
    emptyText: 'Nobody mentioned you in an open issue or pull request.',
  },
] as const;

/** The start page: everything on GitHub that is waiting on the user, one tab per list. */
@Component({
  selector: 'app-overview-page',
  imports: [FilterBar, ListSkeleton, ListTabs, LoadError, MatIconModule, RefreshStatus],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview.css',
})
export class OverviewPage implements OnInit {
  private readonly overviewService = inject(OverviewService);
  private readonly gitHubAccessService = inject(GitHubAccessService);
  /** The user's filters, shared with the list pages. */
  readonly filterState = inject(FilterState);

  /** Everything GitHub returned; `undefined` while loading or after an error. */
  readonly overview = signal<Overview | undefined>(undefined);
  readonly loadError = signal<string | undefined>(undefined);
  /** `undefined` until loaded; the page works without it. */
  readonly access = signal<GitHubAccess | undefined>(undefined);
  readonly filters = this.filterState.filters;
  readonly selectedTab = signal(0);
  /** When the shown overview came from GitHub. */
  readonly loadedAt = signal(new Date());
  readonly refreshing = signal(false);
  readonly refreshFailed = signal(false);

  readonly visible = computed(() => {
    const overview = this.overview();
    return overview && applyFilters(overview, this.filters());
  });
  readonly totalCount = computed(() => {
    const overview = this.overview();
    return overview ? countItems(overview) : 0;
  });
  readonly shownCount = computed(() => {
    const visible = this.visible();
    return visible ? countItems(visible) : 0;
  });
  readonly filterOptions = computed(() => {
    const overview = this.overview();
    return overview ? filterOptions(overview, this.filters()) : { owners: [], labels: [] };
  });
  readonly tabs = computed<ListTab[]>(() => {
    const overview = this.overview();
    const visible = this.visible();
    if (!overview || !visible) {
      return [];
    }
    return TABS.map((tab) => {
      const hiddenHere = overview[tab.section].length - visible[tab.section].length;
      const onGitHub = overview.totals[tab.section];
      return {
        label: tab.label,
        // What the tab shows, so the count always matches the list.
        count: visible[tab.section].length,
        items: visible[tab.section],
        emptyText: hiddenHere > 0 ? `All ${hiddenHere} hidden by your filters.` : tab.emptyText,
        ...(onGitHub.has_more && { total: onGitHub.total, moreUrl: onGitHub.search_url }),
      };
    });
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

  /** Load the overview with the user's filters, e.g. again after an error. */
  load(): void {
    this.overview.set(undefined);
    this.loadError.set(undefined);
    forkJoin({
      overview: this.overviewService.load(),
      // Without stored filters the overview is still useful, just unfiltered.
      filters: this.filterState.load(),
    }).subscribe({
      next: ({ overview }) => {
        this.showOverview(overview);
        this.selectedTab.set(firstTabWithItems(this.tabs()));
      },
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
    this.overviewService
      .load()
      .pipe(finalize(() => this.refreshing.set(false)))
      .subscribe({
        next: (overview) => this.showOverview(overview),
        error: () => this.refreshFailed.set(true),
      });
  }

  private showOverview(overview: Overview): void {
    this.overview.set(overview);
    this.loadedAt.set(new Date());
    this.refreshFailed.set(false);
  }
}
