import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, forkJoin, map, of, Subject } from 'rxjs';

import { LoadError, loadErrorMessage } from '../../layout/load-error/load-error';
import { ListSkeleton } from '../../layout/list-skeleton/list-skeleton';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewService } from '../../services/overview';
import {
  NO_FILTERS,
  OverviewFilters,
  OverviewFiltersService,
} from '../../services/overview-filters';
import { FilterBar } from './filters/filter-bar';
import { applyFilters, countItems, filterOptions, toggleEntry } from './filters/filtering';
import { GitHubAccessCard } from './github-access/github-access';
import { firstTabWithItems, ListTab, ListTabs } from './list-tabs/list-tabs';

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
  imports: [FilterBar, GitHubAccessCard, LoadError, ListSkeleton, ListTabs],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview.css',
})
export class OverviewPage implements OnInit {
  private readonly overviewService = inject(OverviewService);
  private readonly filtersService = inject(OverviewFiltersService);
  private readonly gitHubAccessService = inject(GitHubAccessService);
  /** Saves one after the other, so the last change is the one that stays stored. */
  private readonly filterSaves = new Subject<OverviewFilters>();

  /** Everything GitHub returned; `undefined` while loading or after an error. */
  readonly overview = signal<Overview | undefined>(undefined);
  readonly loadError = signal<string | undefined>(undefined);
  /** `undefined` until loaded; the page works without it. */
  readonly access = signal<GitHubAccess | undefined>(undefined);
  readonly filters = signal<OverviewFilters>(NO_FILTERS);
  readonly filterSaveFailed = signal(false);
  readonly selectedTab = signal(0);

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
      return {
        label: tab.label,
        count: visible[tab.section].length,
        items: visible[tab.section],
        emptyText: hiddenHere > 0 ? `All ${hiddenHere} hidden by your filters.` : tab.emptyText,
      };
    });
  });

  /** Without any installation every list would be empty, which would wrongly read as "nothing to do". */
  readonly installedNowhere = computed(() => this.access()?.installations.length === 0);
  readonly nothingWaiting = computed(() => !!this.overview() && this.totalCount() === 0);

  constructor() {
    this.filterSaves
      .pipe(
        concatMap((filters) =>
          this.filtersService.save(filters).pipe(
            map(() => true),
            catchError(() => of(false)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((saved) => this.filterSaveFailed.set(!saved));
  }

  ngOnInit(): void {
    this.load();
  }

  /** Load the overview with the user's filters, and the GitHub access, e.g. again after an error. */
  load(): void {
    this.overview.set(undefined);
    this.loadError.set(undefined);
    forkJoin({
      overview: this.overviewService.load(),
      // Without stored filters the overview is still useful, just unfiltered.
      filters: this.filtersService.load().pipe(catchError(() => of(NO_FILTERS))),
    }).subscribe({
      next: ({ overview, filters }) => {
        this.filters.set(filters);
        this.overview.set(overview);
        this.selectedTab.set(firstTabWithItems(this.tabs()));
      },
      error: (error: unknown) => this.loadError.set(loadErrorMessage(error)),
    });
    this.gitHubAccessService.load().subscribe({
      next: (access) => this.access.set(access),
      error: () => this.access.set(undefined),
    });
  }

  /** Show a hidden owner or repository again, or hide a shown one. */
  toggleScope(scope: string): void {
    this.saveFilters({ ...this.filters(), hidden: toggleEntry(this.filters().hidden, scope) });
  }

  /** Pick a label to show only items carrying it, or unpick it. */
  toggleLabel(label: string): void {
    this.saveFilters({ ...this.filters(), labels: toggleEntry(this.filters().labels, label) });
  }

  clearFilters(): void {
    this.saveFilters(NO_FILTERS);
  }

  private saveFilters(filters: OverviewFilters): void {
    this.filters.set(filters);
    this.filterSaves.next(filters);
  }
}
