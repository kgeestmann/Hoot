import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL } from '../api';
import { Overview, OverviewService } from './overview';

describe('OverviewService', () => {
  let service: OverviewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OverviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the overview from the backend', () => {
    const overview: Overview = {
      assigned_issues: [],
      pull_requests: [],
      review_requests: [],
      mentions: [],
      totals: {
        assigned_issues: { total: 0, has_more: false, search_url: '' },
        pull_requests: { total: 0, has_more: false, search_url: '' },
        review_requests: { total: 0, has_more: false, search_url: '' },
        mentions: { total: 0, has_more: false, search_url: '' },
      },
    };
    let loaded: Overview | undefined;

    service.load().subscribe((result) => (loaded = result));
    http.expectOne(`${API_URL}/overview`).flush(overview);

    expect(loaded).toEqual(overview);
  });
});
