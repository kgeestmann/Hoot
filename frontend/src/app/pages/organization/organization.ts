import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, Subject, switchMap, tap } from 'rxjs';

import { LoadError, loadErrorMessage } from '../../layout/load-error/load-error';
import { SectionsSkeleton } from '../../layout/sections-skeleton/sections-skeleton';
import { OrganizationsService, OrgOverview } from '../../services/organizations';
import { OverviewSection } from '../overview/overview-section/overview-section';

/** The team view of one organization: what needs the team's attention, no per-person numbers. */
@Component({
  selector: 'app-organization-page',
  imports: [LoadError, OverviewSection, SectionsSkeleton],
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

/** A 404 means Hoot isn't installed there for the user; other errors as on the overview. */
function orgLoadErrorMessage(error: unknown, organization: string): string {
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return `Hoot isn't installed on ${organization}, or you can't see it.`;
  }
  return loadErrorMessage(error);
}
