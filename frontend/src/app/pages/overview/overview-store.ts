import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, shareReplay, tap, throwError } from 'rxjs';

import { Overview, OverviewService } from '../../services/overview';

/**
 * The user's overview, loaded once and shared: the dashboard shows it and the sidebar counts
 * from it. `reload` fetches it again, and both see the new data.
 */
@Injectable({
  providedIn: 'root',
})
export class OverviewStore {
  private readonly api = inject(OverviewService);
  private request?: Observable<Overview>;

  /** The latest overview; `undefined` until the first one arrived. */
  readonly overview = signal<Overview | undefined>(undefined);

  /** The overview, from GitHub the first time and shared after that. */
  load(): Observable<Overview> {
    this.request ??= this.fetch();
    return this.request;
  }

  /** Ask GitHub again; until the answer arrives the current overview stays. */
  reload(): Observable<Overview> {
    this.request = this.fetch();
    return this.request;
  }

  private fetch(): Observable<Overview> {
    const request: Observable<Overview> = this.api.load().pipe(
      tap((overview) => this.overview.set(overview)),
      // A failed request isn't kept, so the next load asks again.
      catchError((error: unknown) => {
        if (this.request === request) {
          this.request = undefined;
        }
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return request;
  }
}
