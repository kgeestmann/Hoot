import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';

import { API_URL } from '../api';

/** An account (user or organization) where Hoot is installed on GitHub. */
export interface Installation {
  account: string;
  /** GitHub's account type: "User" or "Organization". */
  account_type: string;
  all_repositories: boolean;
  /** GitHub page where the user changes which repositories Hoot sees. */
  settings_url: string;
}

export interface GitHubAccess {
  /** GitHub's page for installing Hoot on more accounts or requesting it for an organization. */
  install_url: string;
  installations: Installation[];
}

/**
 * Asks the backend where Hoot can see the user's repositories on GitHub, once per app start:
 * the sidenav and the overview share the answer. Signing in, signing out and installing the
 * app on GitHub all reload the app, so the answer can't go stale in between.
 */
@Injectable({
  providedIn: 'root',
})
export class GitHubAccessService {
  private readonly http = inject(HttpClient);
  private access?: Observable<GitHubAccess>;

  /** The accounts where Hoot is installed and the URL of GitHub's install page. */
  load(): Observable<GitHubAccess> {
    this.access ??= this.http.get<GitHubAccess>(`${API_URL}/github/installations`).pipe(
      // A failed request isn't kept, so retrying asks the backend again.
      catchError((error: unknown) => {
        this.access = undefined;
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return this.access;
  }
}
