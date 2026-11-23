# Frontend (CLAUDE.md)

Rules for working in `frontend/`. The guides are in `docs/frontend/`: `architecture.md` (structure, state, routing), `design-system.md` (tokens, buttons, icons, logo), `components.md` (every reusable component), `pages.md` (what each page does). Update the matching one in the same PR.

## Architecture

- **Standalone components, zoneless** (no zone.js): the view only re-renders on signal updates, template events or `markForCheck`. Keep everything a template reads in signals; a plain field set inside `subscribe` won't show up (#35). Use `input()`, `output()`, `model()` and `computed`.
- **Bootstrapping** (`src/main.ts`): router, `PageTitle` as `TitleStrategy`, `provideIcons()`, `HttpClient` with `sessionInterceptor` and `DEMO_INTERCEPTORS`, and an app initializer that loads the session from `/profile` before the first render.
- **Backend:** `API_URL` in `src/app/api.ts` (`http://localhost:8000`); the production build replaces it with `api.production.ts` (`/api`, behind Caddy on the same domain). Build every backend URL from `API_URL`. `services/` has one service per backend resource, holding the response types that mirror `backend/app/schemas.py`. `services/session-interceptor.ts` adds `withCredentials` and sends the user to `/login` on a 401 during an active session. Never store tokens in `localStorage`; the session is the HttpOnly cookie.
- **Routes** (`app.routes.ts`, all lazy-loaded): `/` overview, the four list pages from `pages/list/list-pages.ts`, `/orgs/:organization`, `/github-access`, `/profile` (all `authGuard`) and `/login` (`publicGuard`). The route's `title` is the page heading (`services/page-title.ts`): the single `h1` in the top bar and the tab title "Hoot: Overview". Pages don't add their own `h1`.
- **Shared state** in root services that load once and don't cache failures: `services/auth.ts` (user), `pages/overview/overview-store.ts` (the overview, shared by the dashboard and the sidebar counts), `pages/overview/filters/filter-state.ts` (filters, shared by the overview and the list pages), `services/github-access.ts` (installations), `pages/overview/item-state/item-state-store.ts` (done and snoozed items, applied with `withoutSettled` wherever items are counted or listed). Drop answers that arrive after a newer request.
- **Shared UI:** `layout/` (sidenav with the install banner, load-error, list-skeleton, install-banner); items in `pages/overview/item/` (`item-meta`, `item-chips`); lists in `pages/overview/overview-section`, `list-tabs` (team view) and `pages/list/item-panels` (list pages). Check `docs/frontend/components.md` before building something new.
- **Material list rows only project their direct children:** put `item-meta` and `item-chips` inside the row's `matListItemLine`s.
- **Demo mode:** `src/app/demo/` plays the backend in the browser for `npm run demo` (only the `demo` build configuration includes it, via `fileReplacements`). When a route or response shape changes, update `demo-backend.ts` and `demo-data.ts` too. Demo names start with `demo-`.

## Design

- **Angular Material components** (lists, menus, chips, checkboxes, tabs, cards, icons) rather than plain HTML elements with custom CSS (#99).
- **Tokens only:** `--mat-sys-*` (colours, type scale, corners, elevation) and `--hoot-*` in `src/styles.css` (`--hoot-brand`, `--hoot-space-*`, `--hoot-status-*`, …). Never hard-code colours, font sizes or spacing.
- **Dark mode** follows the system: a new colour token needs `light-dark(light, dark)` with contrast checked in both.
- **Brand orange** `--hoot-brand` is only a fill with `--hoot-on-brand` text; orange text uses `--mat-sys-primary`.
- **Buttons:** `mat-flat-button` for the one primary action per view (brand orange with dark text via `material-theme.scss`), `mat-stroked-button` secondary, `mat-button` tertiary; cards are `mat-card appearance="outlined"`.
- **Never colour alone:** every state has an icon or text too.
- **Icons** are `<mat-icon svgIcon="…">` with the Material Symbols Outlined paths in `icons.ts` (copy new ones from `google/material-design-icons`; no icon font). `src/test-providers.ts` registers them for every spec. The logo is the icon `hoot`; its drawing also lives in `public/favicon.svg`, `public/favicon.ico` and `../docs/logo.svg`, so change them together.
- **No emojis.** Fonts are self-hosted via `@fontsource`; no Google Fonts or other CDNs.
- `src/_theme-colors.scss` comes from Angular Material's theme-color schematic; don't edit it by hand (command in `docs/frontend/design-system.md`).
- The binding rules: `docs/specs/design-rules.md`.

## Tests

`npm test` (Vitest, jsdom). Specs sit next to the code. Replace services with small fakes or use `HttpTestingController`. jsdom has no layout, so assert text and attributes (`data-mat-icon-name` for icons); tabs need `animationDuration="0ms"` to render their content. Format changed files with `npx prettier --write <files>`, not whole folders.
