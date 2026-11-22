import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../api';

/** The overview's filters as stored per user on the backend; all entries lowercase. */
export interface OverviewFilters {
  /** Owners ("octo-org") and repositories ("octo-org/hoot") hidden from the overview. */
  hidden: string[];
  /** Labels to show only; empty means every label shows. */
  labels: string[];
}

export const NO_FILTERS: OverviewFilters = { hidden: [], labels: [] };

/** Loads and saves the overview's filters. */
@Injectable({
  providedIn: 'root',
})
export class OverviewFiltersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/overview/filters`;

  load(): Observable<OverviewFilters> {
    return this.http.get<OverviewFilters>(this.url);
  }

  save(filters: OverviewFilters): Observable<OverviewFilters> {
    return this.http.put<OverviewFilters>(this.url, filters);
  }
}
