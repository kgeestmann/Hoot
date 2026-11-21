import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { Overview, OverviewService } from '../../services/overview';
import { GitHubAccessCard } from './github-access/github-access';
import { OverviewSection } from './overview-section/overview-section';

/** The start page: everything on GitHub that is waiting on the user. */
@Component({
  selector: 'app-overview-page',
  imports: [GitHubAccessCard, OverviewSection],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview.css',
})
export class OverviewPage implements OnInit {
  private readonly overviewService = inject(OverviewService);
  private readonly gitHubAccessService = inject(GitHubAccessService);

  /** `undefined` while loading or after an error. */
  readonly overview = signal<Overview | undefined>(undefined);
  readonly loadError = signal<string | undefined>(undefined);
  /** `undefined` until loaded; the page works without it. */
  readonly access = signal<GitHubAccess | undefined>(undefined);

  /** Without any installation every list would be empty, which would wrongly read as "nothing to do". */
  readonly installedNowhere = computed(() => this.access()?.installations.length === 0);
  readonly nothingWaiting = computed(() => {
    const overview = this.overview();
    return !!overview && Object.values(overview).every((items) => items.length === 0);
  });

  ngOnInit(): void {
    this.load();
  }

  /** Load the overview and the GitHub access, e.g. again after an error. */
  load(): void {
    this.overview.set(undefined);
    this.loadError.set(undefined);
    this.overviewService.load().subscribe({
      next: (overview) => this.overview.set(overview),
      error: (error: unknown) => this.loadError.set(loadErrorMessage(error)),
    });
    this.gitHubAccessService.load().subscribe({
      next: (access) => this.access.set(access),
      error: () => this.access.set(undefined),
    });
  }
}

/** Say whose fault a failed load is, so the user knows whether retrying can help. */
function loadErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return "Can't reach Hoot's server. Check your connection and try again.";
  }
  return "GitHub didn't answer. Try again in a moment.";
}
