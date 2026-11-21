import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL } from '../api';
import { GitHubAccess, GitHubAccessService } from './github-access';

describe('GitHubAccessService', () => {
  let service: GitHubAccessService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GitHubAccessService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the installations from the backend', () => {
    const access: GitHubAccess = {
      install_url: 'https://github.com/apps/hoot/installations/new',
      installations: [],
    };
    let loaded: GitHubAccess | undefined;

    service.load().subscribe((result) => (loaded = result));
    http.expectOne(`${API_URL}/github/installations`).flush(access);

    expect(loaded).toEqual(access);
  });
});
