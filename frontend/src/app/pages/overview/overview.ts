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
import { SectionsSkeleton } from '../../layout/sections-skeleton/sections-skeleton';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewService } from '../../services/overview';
import { OverviewFiltersService } from '../../services/overview-filters';
import { applyFilters, countItems, filterOptions, toggleScope } from './filters/filtering';
import { OverviewFilters } from './filters/overview-filters';
import { GitHubAccessCard } from './github-access/github-access';
import { OverviewSection } from './overview-section/overview-section';

/** The start page: everything on GitHub that is waiting on the user. */
@Component({
  selector: 'app-overview-page',
  imports: [GitHubAccessCard, LoadError, OverviewFilters, OverviewSection, SectionsSkeleton],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview.css',
})
export class OverviewPage implements OnInit {
  private readonly overviewService = inject(OverviewService);
  private readonly filtersService = inject(OverviewFiltersService);
  private readonly gitHubAccessService = inject(GitHubAccessService);
  /** Saves one after the other, so the last change is the one that stays stored. */
  private readonly filterSaves = new Subject<string[]>();

  /** Everything GitHub returned; `undefined` while loading or after an error. */
  readonly overview = signal<Overview | undefined>(undefined);
  readonly loadError = signal<string | undefined>(undefined);
  /** `undefined` until loaded; the page works without it. */
  readonly access = signal<GitHubAccess | undefined>(undefined);
  /** Lowercase owners and repositories the user hid. */
  readonly hidden = signal<string[]>([]);
  readonly filterSaveFailed = signal(false);

  private readonly hiddenSet = computed(() => new Set(this.hidden()));
  readonly visible = computed(() => {
    const overview = this.overview();
    return overview && applyFilters(overview, this.hiddenSet());
  });
  readonly hiddenCount = computed(() => {
    const overview = this.overview();
    const visible = this.visible();
    return overview && visible ? countItems(overview) - countItems(visible) : 0;
  });
  readonly filterOptions = computed(() => {
    const overview = this.overview();
    return overview ? filterOptions(overview, this.hiddenSet()) : [];
  });

  /** Without any installation every list would be empty, which would wrongly read as "nothing to do". */
  readonly installedNowhere = computed(() => this.access()?.installations.length === 0);
  readonly nothingWaiting = computed(() => {
    const overview = this.overview();
    return !!overview && countItems(overview) === 0;
  });

  constructor() {
    this.filterSaves
      .pipe(
        concatMap((hidden) =>
          this.filtersService.save(hidden).pipe(
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
      hidden: this.filtersService.load().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ overview, hidden }) => {
        this.hidden.set(hidden);
        this.overview.set(overview);
      },
      error: (error: unknown) => this.loadError.set(loadErrorMessage(error)),
    });
    this.gitHubAccessService.load().subscribe({
      next: (access) => this.access.set(access),
      error: () => this.access.set(undefined),
    });
  }

  /** Show a hidden owner or repository again, or hide a shown one, and save that. */
  toggleFilter(scope: string): void {
    const hidden = toggleScope(this.hidden(), scope);
    this.hidden.set(hidden);
    this.filterSaves.next(hidden);
  }
}
