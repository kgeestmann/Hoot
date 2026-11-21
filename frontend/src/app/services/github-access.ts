import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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

/** Asks the backend where Hoot can see the user's repositories on GitHub. */
@Injectable({
  providedIn: 'root',
})
export class GitHubAccessService {
  private readonly http = inject(HttpClient);

  /** Load the accounts where Hoot is installed and the URL of GitHub's install page. */
  load(): Observable<GitHubAccess> {
    return this.http.get<GitHubAccess>(`${API_URL}/github/installations`);
  }
}
