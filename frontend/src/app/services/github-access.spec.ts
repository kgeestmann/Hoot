import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL } from '../api';
import { GitHubAccess, GitHubAccessService } from './github-access';

const ACCESS: GitHubAccess = {
  install_url: 'https://github.com/apps/hoot/installations/new',
  installations: [],
};

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

  it('asks the backend only once, however often it is loaded', () => {
    const answers: GitHubAccess[] = [];

    service.load().subscribe((access) => answers.push(access));
    service.load().subscribe((access) => answers.push(access));
    http.expectOne(`${API_URL}/github/installations`).flush(ACCESS);
    service.load().subscribe((access) => answers.push(access));

    expect(answers).toEqual([ACCESS, ACCESS, ACCESS]);
  });

  it('asks again after a failed request', () => {
    let failed = false;
    let loaded: GitHubAccess | undefined;

    service.load().subscribe({ error: () => (failed = true) });
    http
      .expectOne(`${API_URL}/github/installations`)
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    service.load().subscribe((access) => (loaded = access));
    http.expectOne(`${API_URL}/github/installations`).flush(ACCESS);

    expect(failed).toBe(true);
    expect(loaded).toEqual(ACCESS);
  });
});
