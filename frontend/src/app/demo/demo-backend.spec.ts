import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_URL } from '../api';
import { GitHubAccess } from '../services/github-access';
import { ItemState } from '../services/item-states';
import { ListPage } from '../services/lists';
import { OrgOverview } from '../services/organizations';
import { Overview } from '../services/overview';
import { OverviewFilters } from '../services/overview-filters';
import { createDemoBackend, currentScenario } from './demo-backend';
import { DemoScenario } from './demo-data';

describe('demo backend', () => {
  function client(scenario: DemoScenario): HttpClient {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([createDemoBackend(scenario, new Date(), 0)])),
      ],
    });
    return TestBed.inject(HttpClient);
  }

  const get = <T>(http: HttpClient, path: string, params: Record<string, string> = {}) =>
    firstValueFrom(http.get<T>(`${API_URL}${path}`, { params }));

  async function status(promise: Promise<unknown>): Promise<number> {
    try {
      await promise;
      return 200;
    } catch (error) {
      return (error as HttpErrorResponse).status;
    }
  }

  it('signs in a made-up user', async () => {
    const http = client('full');

    expect(await get(http, '/profile')).toEqual({ id: 1, login: 'demo-user' });
  });

  it('fills the overview, with one list longer than the overview shows', async () => {
    const overview = await get<Overview>(client('full'), '/overview');

    expect(overview.pull_requests.length).toBeGreaterThan(0);
    expect(overview.assigned_issues.length).toBe(50);
    expect(overview.totals.assigned_issues).toEqual(
      expect.objectContaining({ total: 62, has_more: true }),
    );
  });

  it('pages through a list with the cursor', async () => {
    const http = client('full');

    const first = await get<ListPage>(http, '/lists/assigned_issues');
    const second = await get<ListPage>(http, '/lists/assigned_issues', {
      after: first.end_cursor!,
    });

    expect([first.items.length, first.has_more]).toEqual([50, true]);
    expect([second.items.length, second.has_more, second.end_cursor]).toEqual([12, false, null]);
  });

  it('sorts a list by the chosen order', async () => {
    const http = client('full');

    const oldest = await get<ListPage>(http, '/lists/assigned_issues', { sort: 'oldest' });
    const created = await get<ListPage>(http, '/lists/assigned_issues', { sort: 'created' });

    expect(oldest.items[0].number).toBe(71);
    expect(created.items[0].number).toBe(10);
  });

  it('keeps the filters it is given, normalised like the backend', async () => {
    const http = client('full');

    await firstValueFrom(
      http.put(`${API_URL}/overview/filters`, {
        hidden: [' Demo-Labs ', 'demo-labs'],
        labels: ['Bug'],
      }),
    );

    expect(await get<OverviewFilters>(http, '/overview/filters')).toEqual({
      hidden: ['demo-labs'],
      labels: ['bug'],
    });
  });

  it('keeps done and snoozed items until one is brought back', async () => {
    const http = client('full');
    const url = 'https://github.com/demo-labs/rocket/issues/12';

    await firstValueFrom(http.put(`${API_URL}/item-states`, { url, state: 'done' }));
    const stored = await get<ItemState[]>(http, '/item-states');
    await firstValueFrom(http.delete(`${API_URL}/item-states`, { params: { url } }));

    expect(stored.map((state) => [state.url, !!state.done_at])).toEqual([[url, true]]);
    expect(await get<ItemState[]>(http, '/item-states')).toEqual([]);
  });

  it('has a team view for its organizations and 404 for others', async () => {
    const http = client('full');

    expect((await get<OrgOverview>(http, '/orgs/demo-labs/overview')).organization).toBe(
      'demo-labs',
    );
    expect(await status(get(http, '/orgs/someone-else/overview'))).toBe(404);
  });

  it('shows nothing waiting in the empty scenario', async () => {
    const http = client('empty');

    const overview = await get<Overview>(http, '/overview');
    const access = await get<GitHubAccess>(http, '/github/installations');

    expect(overview.assigned_issues).toEqual([]);
    expect(access.installations.length).toBeGreaterThan(0);
  });

  it('has no installation in the not-installed scenario', async () => {
    const access = await get<GitHubAccess>(client('not-installed'), '/github/installations');

    expect(access.installations).toEqual([]);
  });

  it('fails the GitHub calls in the errors scenario, but keeps the session', async () => {
    const http = client('errors');

    expect(await status(get(http, '/overview'))).toBe(502);
    expect(await status(get(http, '/lists/mentions'))).toBe(502);
    expect(await status(get(http, '/profile'))).toBe(200);
  });

  it('only uses fictional names', async () => {
    const overview = await get<Overview>(client('full'), '/overview');

    const owners = new Set(
      Object.values(overview)
        .filter(Array.isArray)
        .flat()
        .map((item) => item.repository.split('/')[0]),
    );
    expect([...owners].every((owner) => owner.startsWith('demo-'))).toBe(true);
  });
});

describe('currentScenario', () => {
  function location(search: string): Location {
    return { search } as Location;
  }

  beforeEach(() => sessionStorage.clear());

  it('takes the scenario from the URL and keeps it for later navigations', () => {
    expect(currentScenario(location('?scenario=errors'), sessionStorage)).toBe('errors');
    expect(currentScenario(location(''), sessionStorage)).toBe('errors');
  });

  it('shows the full scenario by default and for unknown names', () => {
    expect(currentScenario(location(''), sessionStorage)).toBe('full');
    expect(currentScenario(location('?scenario=nonsense'), sessionStorage)).toBe('full');
  });
});
