# Frontend architecture

The Angular app in `frontend/src/app/`: how it is wired, where state lives and how data flows. The visual rules are in [design-system.md](design-system.md), the reusable components in [components.md](components.md), each page's behaviour in [pages.md](pages.md).

## Stack

Angular 22 with standalone components (no NgModules) and Angular Material 3. Tests with Vitest and jsdom. Prettier for formatting (`frontend/.prettierrc`), no linter.

## Zoneless and signals

The app runs **without zone.js**. The view only re-renders on a signal update, a template event or `markForCheck`. So:

- Keep every value a template reads in a **signal** (`signal`, `computed`, `input`, `model`). A plain field set inside `subscribe` won't show up.
- Derive with `computed` instead of copying values around.
- Components use `input()`, `output()` and `model()`, not the decorators.

## Bootstrapping

`src/main.ts` provides:

| Provider | Why |
| --- | --- |
| `provideRouter(routes)` | Lazy routes from `app.routes.ts` |
| `TitleStrategy` → `PageTitle` | The route's `title` becomes the top bar heading and the tab title ("Hoot: Overview") |
| `provideIcons()` | Registers the Material Symbols and the logo from `icons.ts` |
| `provideHttpClient(withXhr(), withInterceptors([sessionInterceptor, ...DEMO_INTERCEPTORS]))` | Credentials and 401 handling; the demo backend in the demo build |
| `provideAppInitializer(() => inject(AuthService).loadSession())` | The session is known before the first render, so the sidebar shows the right navigation |

## Folders

| Folder | Holds |
| --- | --- |
| `pages/` | One folder per route, lazy-loaded. Components used by only one page live in its folder. |
| `pages/overview/` | The dashboard, plus the pieces shared with the list pages and the team view: `filters/`, `item/`, `overview-section/`, `list-tabs/`, `refresh-status/`, `overview-store.ts`, `summary.ts` |
| `pages/list/` | The four list pages (`work-list`), their config (`list-pages.ts`) and the expandable entries (`item-panels/`) |
| `layout/` | The app shell (`sidenav`) and shared UI states: `load-error`, `list-skeleton`, `install-banner` |
| `services/` | One service per backend resource, plus auth, the session interceptor and the page title |
| `guards/` | `authGuard` and `publicGuard` |
| `demo/` | The demo backend for `npm run demo` (below) |
| `icons.ts` | Material Symbols paths and the logo |
| `api.ts` | `API_URL`, the backend's base URL (`http://localhost:8000`); the production build swaps in `api.production.ts` (`/api`) |

## Routing

All pages are lazy-loaded (`loadComponent`), so the first download only holds the shell.

| Path | Page | Guard |
| --- | --- | --- |
| `/` | `pages/overview` (dashboard) | `authGuard` |
| `/pull-requests`, `/review-requests`, `/assigned`, `/mentions` | `pages/list/work-list`, configured by `LIST_PAGES` (passed as route `data.page`) | `authGuard` |
| `/orgs/:organization` | `pages/organization` (team view) | `authGuard` |
| `/github-access` | `pages/github-access` | `authGuard` |
| `/profile` | `pages/profile` | `authGuard` |
| `/login` | `pages/login` | `publicGuard` |

`authGuard` sends signed-out users to `/login`; `publicGuard` sends signed-in users from `/login` to `/`. Both reuse the session loaded at startup. A route's `title` is the page heading: pages don't add their own `h1`.

## State

Data that several views share lives in root services, each loading once and sharing the result:

| State | Where | Shared by |
| --- | --- | --- |
| Signed-in user | `services/auth.ts` (`user`, `isLoggedIn` signals; `loadSession` asks `GET /profile` once) | Guards, sidebar, interceptor |
| The overview | `pages/overview/overview-store.ts` (`overview` signal; `load` shares one request, `reload` replaces it while the current data stays) | Dashboard, sidebar counts |
| Filters | `pages/overview/filters/filter-state.ts` (`filters` signal; changes apply at once and are saved one after the other) | Dashboard, list pages, sidebar counts |
| Where Hoot is installed | `services/github-access.ts` (cached request) | Sidebar (teams, install banner), dashboard, GitHub access page |

The rules these follow:

- A failed request isn't cached, so retrying asks the backend again.
- Page-local state (a list page's items, sort, grouping) stays in the page component.
- An answer that arrives after a newer request was started is dropped (a request counter), so changing the sort quickly can't show an old order.
- Signing in is always a full page navigation, so every root service starts empty for a new session.

## Talking to the backend

- `services/*.ts` wrap `HttpClient` per resource (`overview`, `lists`, `overview-filters`, `organizations`, `github-access`, `auth`) and hold the response types.
- `services/session-interceptor.ts` adds `withCredentials` to every backend request, and on a `401` during an active session clears it and opens `/login`.
- Tokens are never stored in `localStorage` or anywhere else in the browser: the session is the HttpOnly cookie.
- The sign-in is a link to `/auth/github/login` (a full page navigation), not an API call.
- `layout/load-error` turns an error into a message that says whether Hoot's server or GitHub failed.

## Demo mode

`npm run demo` serves the `demo` build configuration. It swaps `demo/demo-interceptors.ts` (an empty list) for `demo/demo-interceptors.demo.ts` via `fileReplacements` in `angular.json`, which adds `demo/demo-backend.ts`: an interceptor that answers every backend route from `demo/demo-data.ts`. Normal builds contain none of it.

When a backend route or response shape changes, update the demo backend and data too, or the demo falls behind. Scenarios and usage: [development.md](../development.md#demo-mode).

## Tests

Specs sit next to the code (`*.spec.ts`). `src/test-providers.ts` registers the icons for every spec. Patterns used throughout:

- Components render through `TestBed` with their services replaced by small fakes (`{ provide: X, useValue: { load: () => of(...) } }`) or `HttpTestingController`.
- jsdom has no layout: assert text, attributes and `data-mat-icon-name`, not sizes or positions.
- Tabs need `animationDuration="0ms"` to render their content in tests.
