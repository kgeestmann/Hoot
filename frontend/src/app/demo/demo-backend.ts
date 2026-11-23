import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { mergeMap, Observable, of, throwError, timer } from 'rxjs';

import { API_URL } from '../api';
import { ListName, ListSort } from '../services/lists';
import { Overview } from '../services/overview';
import { OverviewFilters } from '../services/overview-filters';
import { DEMO_SCENARIOS, DemoItem, DemoScenario, demoWorld } from './demo-data';

/** Answers take this long, so loading states show. */
export const DEMO_LATENCY_MS = 400;
const PAGE_SIZE = 50;
const OVERVIEW_SIZE = 50;
const SCENARIO_KEY = 'hoot-demo-scenario';
const LIST_NAMES: readonly ListName[] = [
  'pull_requests',
  'review_requests',
  'assigned_issues',
  'mentions',
];

/**
 * An interceptor that plays Hoot's backend in the browser with made-up data, for checking the
 * UI without GitHub. Only the `demo` build configuration uses it.
 */
export function createDemoBackend(
  scenario: DemoScenario,
  now: Date,
  latencyMs = DEMO_LATENCY_MS,
): HttpInterceptorFn {
  const world = demoWorld(scenario, now);
  let filters: OverviewFilters = { hidden: [], labels: [] };

  const failing = scenario === 'errors';
  const ok = (body: unknown) => of(new HttpResponse({ status: 200, body }));
  const fail = (status: number, request: HttpRequest<unknown>) =>
    throwError(() => new HttpErrorResponse({ status, url: request.url }));

  function answer(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const path = request.url.slice(API_URL.length);
    if (path === '/profile') {
      return ok({ id: 1, login: world.login });
    }
    if (path === '/logout') {
      return of(new HttpResponse({ status: 204 }));
    }
    if (path === '/overview/filters') {
      if (request.method === 'PUT') {
        filters = normalizeFilters(request.body as OverviewFilters);
      }
      return ok(filters);
    }
    if (path === '/github/installations') {
      return failing ? fail(502, request) : ok(world.access);
    }
    if (path === '/overview') {
      return failing ? fail(502, request) : ok(overview(world.lists));
    }
    const list = path.match(/^\/lists\/(\w+)$/);
    if (list && LIST_NAMES.includes(list[1] as ListName)) {
      if (failing) {
        return fail(502, request);
      }
      const sort = (request.params.get('sort') ?? 'updated') as ListSort;
      return ok(listPage(world.lists[list[1] as ListName], sort, request.params.get('after')));
    }
    const organization = path.match(/^\/orgs\/([\w-]+)\/overview$/);
    if (organization) {
      if (failing) {
        return fail(502, request);
      }
      const team = world.organizations[organization[1].toLowerCase()];
      return team ? ok(team) : fail(404, request);
    }
    return fail(404, request);
  }

  return (request, next) => {
    if (!request.url.startsWith(API_URL)) {
      return next(request);
    }
    return timer(latencyMs).pipe(mergeMap(() => answer(request)));
  };
}

/** The scenario from `?scenario=`, kept for the tab's later navigations; `full` by default. */
export function currentScenario(location: Location, storage: Storage): DemoScenario {
  const asked = new URLSearchParams(location.search).get('scenario');
  if (asked && (DEMO_SCENARIOS as readonly string[]).includes(asked)) {
    storage.setItem(SCENARIO_KEY, asked);
  }
  const kept = storage.getItem(SCENARIO_KEY);
  return kept && (DEMO_SCENARIOS as readonly string[]).includes(kept)
    ? (kept as DemoScenario)
    : 'full';
}

function overview(lists: Record<ListName, DemoItem[]>): Overview {
  const newestFirst = (name: ListName) => sortItems(lists[name], 'updated');
  const total = (name: ListName) => ({
    total: lists[name].length,
    has_more: lists[name].length > OVERVIEW_SIZE,
    search_url: `https://github.com/search?q=${name}&type=issues`,
  });
  return {
    pull_requests: newestFirst('pull_requests').slice(
      0,
      OVERVIEW_SIZE,
    ) as Overview['pull_requests'],
    review_requests: newestFirst('review_requests').slice(0, OVERVIEW_SIZE),
    assigned_issues: newestFirst('assigned_issues').slice(0, OVERVIEW_SIZE),
    mentions: newestFirst('mentions').slice(0, OVERVIEW_SIZE),
    totals: {
      pull_requests: total('pull_requests'),
      review_requests: total('review_requests'),
      assigned_issues: total('assigned_issues'),
      mentions: total('mentions'),
    },
  };
}

function listPage(items: DemoItem[], sort: ListSort, after: string | null) {
  const sorted = sortItems(items, sort);
  const start = after ? Number(atob(after).split(':')[1]) || 0 : 0;
  const end = start + PAGE_SIZE;
  return {
    items: sorted.slice(start, end),
    total: sorted.length,
    has_more: end < sorted.length,
    end_cursor: end < sorted.length ? btoa(`offset:${end}`) : null,
    search_url: 'https://github.com/search?q=demo&type=issues',
  };
}

function sortItems(items: DemoItem[], sort: ListSort) {
  const by = (pick: (entry: DemoItem) => string, direction: 1 | -1) =>
    [...items]
      .sort((a, b) => direction * pick(a).localeCompare(pick(b)))
      .map((entry) => entry.item);
  if (sort === 'oldest') {
    return by((entry) => entry.createdAt, 1);
  }
  if (sort === 'created') {
    return by((entry) => entry.createdAt, -1);
  }
  return by((entry) => entry.item.updated_at, -1);
}

/** Like the backend: trimmed, lowercase, each entry once, sorted. */
function normalizeFilters(filters: OverviewFilters): OverviewFilters {
  const clean = (entries: string[] = []) =>
    [...new Set(entries.map((entry) => entry.trim().toLowerCase()).filter(Boolean))].sort();
  return { hidden: clean(filters.hidden), labels: clean(filters.labels) };
}
