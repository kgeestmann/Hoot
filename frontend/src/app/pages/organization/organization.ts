import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, Subject, switchMap, tap } from 'rxjs';

import { LoadError, loadErrorMessage } from '../../layout/load-error/load-error';
import { ListSkeleton } from '../../layout/list-skeleton/list-skeleton';
import { OrganizationsService, OrgOverview, TeamList } from '../../services/organizations';
import { firstTabWithItems, ListTab, ListTabs } from '../overview/list-tabs/list-tabs';

/** The team view of one organization: what needs the team's attention, no per-person numbers. */
@Component({
  selector: 'app-organization-page',
  imports: [ListSkeleton, ListTabs, LoadError],
  templateUrl: './organization.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './organization.css',
})
export class OrganizationPage {
  private readonly organizations = inject(OrganizationsService);
  private readonly route = inject(ActivatedRoute);
  /** Each organization to load; a new one cancels the request still running. */
  private readonly loads = new Subject<string>();

  readonly organization = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('organization') ?? '')),
    { initialValue: '' },
  );
  readonly selectedTab = signal(0);
  readonly tabs = computed<ListTab[]>(() => {
    const overview = this.overview();
    return overview ? teamTabs(overview) : [];
  });
  /** `undefined` while loading or after an error. */
  readonly overview = signal<OrgOverview | undefined>(undefined);
  readonly loadError = signal<string | undefined>(undefined);

  constructor() {
    this.loads
      .pipe(
        tap(() => {
          this.overview.set(undefined);
          this.loadError.set(undefined);
        }),
        switchMap((organization) =>
          this.organizations.load(organization).pipe(
            map((overview) => ({ overview })),
            catchError((error: unknown) => of({ error: orgLoadErrorMessage(error, organization) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if ('overview' in result) {
          this.overview.set(result.overview);
          this.selectedTab.set(firstTabWithItems(this.tabs()));
        } else {
          this.loadError.set(result.error);
        }
      });

    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.loads.next(params.get('organization') ?? ''));
  }

  /** Load the team view again, e.g. after an error. */
  load(): void {
    this.loads.next(this.organization());
  }
}

/** The four team lists as tabs, with GitHub's totals and links to the full searches. */
function teamTabs(overview: OrgOverview): ListTab[] {
  const days = overview.stale_after_days;
  const tab = (label: string, list: TeamList, emptyText: string): ListTab => ({
    label,
    count: list.total,
    items: list.items,
    emptyText,
    moreUrl: list.search_url,
  });
  return [
    tab(
      'Waiting for review',
      overview.waiting_for_review,
      'No pull request is waiting for a review.',
    ),
    tab('Failing CI', overview.failing_ci, 'No open pull request has failing checks.'),
    tab('Unassigned', overview.unassigned_issues, 'Every open issue has someone assigned.'),
    tab(
      `No update for ${days} days`,
      overview.stale,
      `Nothing open has been left alone for ${days} days.`,
    ),
  ];
}

/** A 404 means Hoot isn't installed there for the user; other errors as on the overview. */
function orgLoadErrorMessage(error: unknown, organization: string): string {
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return `Hoot isn't installed on ${organization}, or you can't see it.`;
  }
  return loadErrorMessage(error);
}
