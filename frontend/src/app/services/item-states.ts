import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../api';

/** An item the user marked as done or snoozed; exactly one of the two times is set. */
export interface ItemState {
  url: string;
  /** Hidden until GitHub updates the item after this moment. */
  done_at: string | null;
  /** Hidden until this moment. */
  snoozed_until: string | null;
}

/** Loads and changes the user's done and snoozed items. */
@Injectable({
  providedIn: 'root',
})
export class ItemStatesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/item-states`;

  load(): Observable<ItemState[]> {
    return this.http.get<ItemState[]>(this.url);
  }

  markDone(itemUrl: string): Observable<ItemState> {
    return this.http.put<ItemState>(this.url, { url: itemUrl, state: 'done' });
  }

  snooze(itemUrl: string, until: Date): Observable<ItemState> {
    return this.http.put<ItemState>(this.url, {
      url: itemUrl,
      state: 'snoozed',
      until: until.toISOString(),
    });
  }

  forget(itemUrl: string): Observable<void> {
    return this.http.delete<void>(this.url, { params: { url: itemUrl } });
  }
}
