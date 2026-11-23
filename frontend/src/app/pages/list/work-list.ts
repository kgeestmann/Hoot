import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPseudoCheckboxModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ListSkeleton } from '../../layout/list-skeleton/list-skeleton';
import { LoadError, loadErrorMessage } from '../../layout/load-error/load-error';
import { ListPage, ListSort, ListsService } from '../../services/lists';
import { OverviewItem } from '../../services/overview';
import { FilterBar } from '../overview/filters/filter-bar';
import { FilterState } from '../overview/filters/filter-state';
import { filterItems, filterOptionsFor } from '../overview/filters/filtering';
import { OverviewSection } from '../overview/overview-section/overview-section';
import { RefreshStatus } from '../overview/refresh-status/refresh-status';
import { ListPageConfig, SORT_OPTIONS } from './list-pages';

/** Items of one repository, for the grouped view. */
export interface RepositoryGroup {
  repository: string;
  items: OverviewItem[];
}

/**
 * One of the overview's lists on its own page: every item (loaded 50 at a time), with the
 * shared filters, a sort order and an optional grouping by repository.
 */
@Component({
  selector: 'app-work-list',
  imports: [
    FilterBar,
    ListSkeleton,
    LoadError,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatPseudoCheckboxModule,
    MatSlideToggleModule,
    OverviewSection,
    RefreshStatus,
  ],
  templateUrl: './work-list.html',
  styleUrl: './work-list.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class WorkList implements OnInit {
  private readonly lists = inject(ListsService);
  /** Counts the first-page loads, so an answer that arrives after a newer request is dropped. */
  private generation = 0;

  readonly config: ListPageConfig = inject(ActivatedRoute).snapshot.data['page'];
  readonly filterState = inject(FilterState);
  readonly sortOptions = SORT_OPTIONS;

  /** Every item loaded so far, in the chosen order. */
  readonly items = signal<OverviewItem[]>([]);
  /** The latest page from GitHub; `undefined` while loading or after an error. */
  readonly page = signal<ListPage | undefined>(undefined);
  readonly loadError = signal<string | undefined>(undefined);
  readonly sort = signal<ListSort>('updated');
  readonly grouped = signal(false);
  readonly loadingMore = signal(false);
  readonly loadMoreFailed = signal(false);
  readonly loadedAt = signal(new Date());
  readonly refreshing = signal(false);
  readonly refreshFailed = signal(false);

  readonly visible = computed(() => filterItems(this.items(), this.filterState.filters()));
  readonly filterOptions = computed(() =>
    filterOptionsFor(this.items(), this.filterState.filters()),
  );
  /** Without items the filter menus would be empty; an active filter stays clearable. */
  readonly showFilters = computed(() => {
    const filters = this.filterState.filters();
    return this.items().length > 0 || filters.hidden.length > 0 || filters.labels.length > 0;
  });
  readonly groups = computed(() => groupByRepository(this.visible()));
  readonly sortLabel = computed(
    () => this.sortOptions.find((option) => option.value === this.sort())!.label,
  );
  readonly emptyText = computed(() => {
    const hidden = this.items().length - this.visible().length;
    return hidden > 0 ? `All ${hidden} loaded hidden by your filters.` : this.config.emptyText;
  });

  ngOnInit(): void {
    this.load();
  }

  /** Load the first page with the user's filters, e.g. again after an error. */
  load(): void {
    const generation = ++this.generation;
    this.page.set(undefined);
    this.loadError.set(undefined);
    forkJoin({
      page: this.lists.load(this.config.list, this.sort()),
      filters: this.filterState.load(),
    }).subscribe({
      next: ({ page }) => generation === this.generation && this.showFirstPage(page),
      error: (error: unknown) =>
        generation === this.generation && this.loadError.set(loadErrorMessage(error)),
    });
  }

  /** Load the first page again while the current items stay visible. */
  refresh(): void {
    const generation = ++this.generation;
    this.refreshing.set(true);
    this.lists.load(this.config.list, this.sort()).subscribe({
      next: (page) => {
        if (generation === this.generation) {
          this.showFirstPage(page);
          this.refreshing.set(false);
        }
      },
      error: () => {
        if (generation === this.generation) {
          this.refreshFailed.set(true);
          this.refreshing.set(false);
        }
      },
    });
  }

  changeSort(sort: ListSort): void {
    if (sort !== this.sort()) {
      this.sort.set(sort);
      this.refresh();
    }
  }

  /** Append the next 50 items. */
  loadMore(): void {
    const cursor = this.page()?.end_cursor;
    if (!cursor || this.loadingMore()) {
      return;
    }
    const generation = this.generation;
    this.loadingMore.set(true);
    this.loadMoreFailed.set(false);
    this.lists.load(this.config.list, this.sort(), cursor).subscribe({
      next: (page) => {
        if (generation === this.generation) {
          this.items.update((items) => [...items, ...page.items]);
          this.page.set(page);
        }
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadMoreFailed.set(generation === this.generation);
        this.loadingMore.set(false);
      },
    });
  }

  private showFirstPage(page: ListPage): void {
    this.items.set(page.items);
    this.page.set(page);
    this.loadedAt.set(new Date());
    this.refreshFailed.set(false);
    this.loadMoreFailed.set(false);
  }
}

/** Group items by repository, groups sorted by name; items keep their order within a group. */
export function groupByRepository(items: readonly OverviewItem[]): RepositoryGroup[] {
  const groups = new Map<string, RepositoryGroup>();
  for (const item of items) {
    const key = item.repository.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { repository: item.repository, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
}
