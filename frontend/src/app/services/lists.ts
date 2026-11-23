import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../api';
import { OverviewItem, PullRequestItem } from './overview';

export type ListName = 'pull_requests' | 'review_requests' | 'assigned_issues' | 'mentions';
export type ListSort = 'updated' | 'oldest' | 'created';

/** One page (up to 50 items) of a list. */
export interface ListPage {
  items: (OverviewItem | PullRequestItem)[];
  /** All matches on GitHub. */
  total: number;
  has_more: boolean;
  /** Pass to `load` to get the next page; `null` on the last one. */
  end_cursor: string | null;
  /** The same search on github.com. */
  search_url: string;
}

/** Loads one of the overview's lists page by page, for the list pages. */
@Injectable({
  providedIn: 'root',
})
export class ListsService {
  private readonly http = inject(HttpClient);

  load(list: ListName, sort: ListSort, after?: string): Observable<ListPage> {
    const params: Record<string, string> = { sort };
    if (after) {
      params['after'] = after;
    }
    return this.http.get<ListPage>(`${API_URL}/lists/${list}`, { params });
  }
}
