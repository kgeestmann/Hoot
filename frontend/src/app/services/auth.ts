import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, of, tap } from 'rxjs';

import { API_URL } from '../api';

export interface User {
  id: number;
  /** GitHub login (username). */
  login: string;
}

/**
 * Knows who is logged in. The session itself is an HttpOnly cookie that only the
 * backend can read, so the frontend asks the backend instead of inspecting a token.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** `undefined` until the backend has been asked, `null` when nobody is logged in. */
  private readonly currentUser = signal<User | null | undefined>(undefined);

  readonly user = computed(() => this.currentUser() ?? null);
  readonly isLoggedIn = computed(() => !!this.currentUser());

  /** Return the logged-in user; the backend is only asked the first time. */
  loadSession(): Observable<User | null> {
    const known = this.currentUser();
    return known === undefined ? this.fetchUser() : of(known);
  }

  /** Forget the user locally, e.g. after the backend rejected the session. */
  clearSession(): void {
    this.currentUser.set(null);
  }

  /** End the session on the backend and go to the login page. */
  logout(): void {
    this.http
      .post(`${API_URL}/logout`, null)
      .pipe(
        finalize(() => {
          this.clearSession();
          this.router.navigate(['/login']);
        }),
      )
      .subscribe({ error: () => undefined });
  }

  private fetchUser(): Observable<User | null> {
    return this.http.get<User>(`${API_URL}/profile`).pipe(
      catchError(() => of(null)),
      tap((user) => this.currentUser.set(user)),
    );
  }
}
