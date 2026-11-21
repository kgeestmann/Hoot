import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../api';

/** An issue or pull request that is waiting on the user. */
export interface OverviewItem {
  kind: 'issue' | 'pull_request';
  title: string;
  /** owner/name */
  repository: string;
  number: number;
  url: string;
  /** ISO 8601 timestamp of the last update. */
  updated_at: string;
}

/** One of the user's own pull requests. */
export interface PullRequestItem extends OverviewItem {
  /** GitHub's SUCCESS, FAILURE, ERROR, PENDING or EXPECTED; null without checks. */
  ci_status: string | null;
  /** GitHub's APPROVED, CHANGES_REQUESTED or REVIEW_REQUIRED; null if no review is required. */
  review_decision: string | null;
}

export interface Overview {
  assigned_issues: OverviewItem[];
  pull_requests: PullRequestItem[];
  review_requests: OverviewItem[];
  mentions: OverviewItem[];
}

/** Loads everything on GitHub that is waiting on the user. */
@Injectable({
  providedIn: 'root',
})
export class OverviewService {
  private readonly http = inject(HttpClient);

  load(): Observable<Overview> {
    return this.http.get<Overview>(`${API_URL}/overview`);
  }
}
