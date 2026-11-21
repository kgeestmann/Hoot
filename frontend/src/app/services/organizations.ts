import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../api';
import { OverviewItem } from './overview';

/** An issue or pull request in an organization's team view. */
export interface TeamItem extends OverviewItem {
  /** ISO 8601 timestamp of when it was opened. */
  created_at: string;
  /** `null` for deleted accounts. */
  author: string | null;
  assignees: string[];
  /** Only set for pull requests. */
  ci_status: string | null;
  review_decision: string | null;
}

export interface TeamList {
  /** All matches on GitHub; `items` holds at most 20 of them. */
  total: number;
  items: TeamItem[];
  /** The same search on github.com, with every match. */
  search_url: string;
}

/** What needs an organization's attention. Deliberately no statistics per person (#28). */
export interface OrgOverview {
  /** The organization's login as GitHub spells it. */
  organization: string;
  stale_after_days: number;
  waiting_for_review: TeamList;
  failing_ci: TeamList;
  unassigned_issues: TeamList;
  stale: TeamList;
}

/** Loads the team view of organizations where Hoot is installed. */
@Injectable({
  providedIn: 'root',
})
export class OrganizationsService {
  private readonly http = inject(HttpClient);

  load(organization: string): Observable<OrgOverview> {
    return this.http.get<OrgOverview>(
      `${API_URL}/orgs/${encodeURIComponent(organization)}/overview`,
    );
  }
}
