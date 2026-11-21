import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_URL } from '../api';

interface OverviewFilters {
  /** Lowercase owners ("octo-org") and repositories ("octo-org/hoot") hidden from the overview. */
  hidden: string[];
}

/** Loads and saves what the user hid from the overview; stored per user on the backend. */
@Injectable({
  providedIn: 'root',
})
export class OverviewFiltersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/overview/filters`;

  load(): Observable<string[]> {
    return this.http.get<OverviewFilters>(this.url).pipe(map((filters) => filters.hidden));
  }

  save(hidden: string[]): Observable<string[]> {
    return this.http
      .put<OverviewFilters>(this.url, { hidden })
      .pipe(map((filters) => filters.hidden));
  }
}
