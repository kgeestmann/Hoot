# Hoot frontend

The Angular app that shows everything waiting on you on GitHub. Angular 22 with standalone components and Angular Material 3, running without zone.js. It talks to the FastAPI backend in `../backend` (see the [root README](../README.md)).

## Commands

Needs Node.js 24 LTS (at least 24.15; Node 25+ breaks `localStorage` in the tests).

| Command | Does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm start` | Dev server on `http://localhost:4200`, reloads on changes; needs the backend on `localhost:8000` |
| `npm run demo` | Dev server with made-up data, no backend or GitHub (`?scenario=full\|empty\|not-installed\|errors`) |
| `npm test` | Unit tests (Vitest and jsdom) |
| `npm run build` | Production build into `dist/` |
| `npx prettier --write <files>` | Format; the config is in `.prettierrc` |

Open the app as `http://localhost:4200`, not `127.0.0.1`, or the session cookie isn't sent.

## Where things are

```
src/
├── main.ts                 bootstrapping: router, title, icons, HTTP, session
├── index.html              favicons, colour scheme
├── styles.css              Hoot's design tokens (--hoot-*)
├── material-theme.scss     Material 3 theme (--mat-sys-*)
├── _theme-colors.scss      tonal palettes, don't edit by hand
├── test-providers.ts       registers the icons for every spec
└── app/
    ├── app.routes.ts       lazy routes and guards
    ├── api.ts              API_URL, the backend's base URL
    ├── icons.ts            Material Symbols paths and the logo
    ├── pages/              one folder per route
    │   ├── overview/       dashboard, plus filters, items, lists, refresh shared by other pages
    │   ├── list/           the four list pages and their expandable entries
    │   ├── organization/   team view
    │   ├── github-access/  where Hoot is installed
    │   ├── login/
    │   └── profile/
    ├── layout/             sidenav (app shell), load-error, list-skeleton, install-banner
    ├── services/           one per backend resource, auth, session interceptor, page title
    ├── guards/             authGuard, publicGuard
    └── demo/               the in-browser demo backend for npm run demo
```

## Guides

| Guide | Covers |
| --- | --- |
| [Architecture](../docs/frontend/architecture.md) | Signals without zone.js, bootstrapping, routing, shared state, talking to the backend, demo mode, test patterns |
| [Design system](../docs/frontend/design-system.md) | Theme, colours and dark mode, type, spacing, buttons, icons, logo, loading/empty/error states |
| [Components](../docs/frontend/components.md) | Every reusable component with its inputs and outputs, and the data helpers |
| [Pages](../docs/frontend/pages.md) | What each page shows and how it behaves |
| [Design rules](../docs/specs/design-rules.md) | The rules behind the design system, and their sources |

## Essentials

- **Signals for everything a template reads.** Without zone.js, a plain field set in `subscribe` doesn't re-render.
- **Angular Material components** before custom HTML and CSS.
- **Tokens only:** `--mat-sys-*` and `--hoot-*`, never hard-coded colours, sizes or spacing. A new colour needs a light and a dark value.
- **Icons** are `<mat-icon svgIcon="…">` from `icons.ts`; no icon font, no emojis.
- **No tokens in the browser:** the session is an HttpOnly cookie; never use `localStorage` for it.
- **A backend change** to a route or response also updates `src/app/demo/`.
