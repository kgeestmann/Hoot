# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Hoot shows everything that is waiting on the user on GitHub (assigned issues, open PRs, review requests, mentions) on one page. It is being built on top of a minimal full-stack JWT login: a FastAPI + SQLAlchemy backend on SQLite and an Angular 22 (Material) frontend. The open issues hold the roadmap. The default branch is `main`, and the main dev machine is Windows.

## Commands

```bash
pip install -r backend/requirements-dev.txt           # in venv/ in the repo root (gitignored); runtime deps are in requirements.txt
python backend/setup_github_app.py                    # once: creates the GitHub App from a manifest and fills .env
python backend/app/main.py                            # → http://localhost:8000 with reload; same as uvicorn backend.app.main:app --reload
pytest                                                # backend tests (backend/tests/, temp SQLite DB)
pytest backend/tests/test_auth.py::test_profile_returns_the_logged_in_user   # single test

cd frontend
npm install                                           # needs Node 24 LTS; Node >= 25 breaks localStorage in the jsdom tests
npm start                                             # ng serve → http://localhost:4200
npm test                                              # ng test (Vitest + jsdom)
npm run build
```

The backend reads a `.env` in the repo root via `backend/app/config.py`. `SECRET_KEY` (at least 32 bytes), `TOKEN_ENCRYPTION_KEY` (a Fernet key), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_APP_SLUG` are required, and the backend refuses to start without them. `GITHUB_CALLBACK_URL`, `FRONTEND_URL`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS` (comma-separated) and `COOKIE_SECURE` have defaults that are documented in the README. `backend/setup_github_app.py` is a standalone one-time script (not imported by the app) that registers the GitHub App via GitHub's manifest flow on `localhost:8000` and writes the credentials and generated keys to `.env`, never overwriting existing values. The tests set all of them in `backend/tests/conftest.py` and never call the real GitHub. Prettier is configured in `frontend/.prettierrc`; there is no linter. The `Tests` workflow (`.github/workflows/tests.yml`) runs `pytest` and the frontend tests on every PR and on pushes to `main`. Don't merge while it is red.

## Code comments

- Give functions and methods a short docstring directly under the signature that says what they do. Mention parameters or return values only when they aren't obvious.
- Keep inline comments short, and add them only where the code isn't self-explanatory. They describe the current code.
- Don't write comments about history or the change itself ("previously", "now", "fixed", "without this … would …"), comments that only restate the code, or long justifications. Those belong in the commit message or the PR description.

## Architecture

- **Backend (`backend/app/`)** is a small FastAPI app. `config.py` loads `.env` and holds all settings. `main.py` holds CORS, JWT creation and validation (PyJWT), the GitHub sign-in flow and all routes: `/auth/github/login`, `/auth/github/callback`, `/logout`, `/profile`, `/overview`, `/overview/filters` (GET and PUT), `/orgs/{organization}/overview` and `/github/installations` (all but the first three protected). `github.py` makes the HTTP calls to GitHub through an `httpx.Client` that routes get via the `get_github_client` dependency; tests override it with the `fake_github` fixture (`backend/tests/conftest.py`, `fake_github.py`). Run every GitHub call on the user's behalf through `github_tokens.call_as_user`, which refreshes expired tokens and raises `SignInRequired` when they can't be renewed; exception handlers in `main.py` turn that into a 401 that clears the session, and any `GitHubError` into a 502. A GitHub App user token only reaches accounts where the app is installed, so an empty result can mean "not installed" (`/github/installations`). `overview.py` holds the GraphQL searches behind `/overview`, `org_overview.py` those of the organization team view. The team view shows work items and team totals only: never add counts, rankings or metrics per person (works council and GDPR, see #28). `crypto.py` encrypts GitHub tokens with Fernet; store them only through `encrypt_token` and never return or log them. Tables are created with `Base.metadata.create_all` on import. There are no migrations, so a model change needs a fresh DB or a manual `ALTER`.
- **Auth flow:** users sign in with GitHub (GitHub App, OAuth with `state` and PKCE; the security rules are in #44). `/auth/github/login` stores state and verifier in the signed, short-lived cookie `hoot_oauth` and redirects to GitHub. `/auth/github/callback` checks the state, exchanges the code, upserts the user by GitHub id, redirects to the fixed `FRONTEND_URL` and sets the JWT (`sub` = the user id as a string) as the HttpOnly cookie `hoot_session`; no token ever appears in a URL or response body. `get_current_user` reads only that cookie (no `Authorization` header), decodes it and loads the user, and protected routes depend on it. `/logout` deletes the cookie.
- **Frontend (`frontend/src/app/`)** uses standalone components and is **zoneless** (no zone.js): the view only re-renders on signal updates, template events or `markForCheck`. Keep state that templates read in signals; a plain field set inside `subscribe` won't show up (see #35). The backend URL is the hard-coded `API_URL` in `api.ts` (`http://localhost:8000`). `services/session-interceptor.ts` adds `withCredentials` to backend requests and sends the user to `/login` on a 401 during an active session. `services/auth.ts` keeps the logged-in user in a signal, loaded once from `/profile` by an app initializer in `main.ts`; never store tokens in `localStorage`. `guards/auth-guard.ts` protects `/` (the overview, `pages/overview/`) and `/profile`, and `guards/public-guard.ts` sends logged-in users from `/login` to `/` (routes are in `app.routes.ts`). Status colours for GitHub states are the `--hoot-status-*` tokens in `styles.css`. Shared UI lives in `layout/` (sidenav, load-error, sections-skeleton, icon). Icons are Material Symbols Outlined as inline SVG paths in `layout/icon/icon.ts`; copy a new one from `google/material-design-icons` instead of adding an icon font. The sidenav is a `mat-sidenav`: open beside the content from 840 px, a drawer behind a top bar below. Buttons and cards are Angular Material (`mat-flat-button` for the one primary action per view, which `material-theme.scss` colours brand orange with dark text; `mat-stroked-button` secondary, `mat-button` tertiary; `mat-card appearance="outlined"`), see #55.
- **Styling** follows the design rules in #55. Use the Material 3 tokens (`--mat-sys-*`: colours, type scale, corners, elevation) and the Hoot tokens in `src/styles.css` (`--hoot-brand`, `--hoot-space-*`, …), and never hard-code colours, font sizes or spacing. The bright brand orange `--hoot-brand` is only a fill with `--hoot-on-brand` text; orange text uses `--mat-sys-primary`. The palettes in `src/_theme-colors.scss` are generated, so don't edit them by hand (regenerate command in the README). Fonts are self-hosted via `@fontsource`, with no Google Fonts or other CDNs.
- **Contract between the two halves:** the login page links to `/auth/github/login` (a full page navigation, not an API call), and the backend sends the browser back to `FRONTEND_URL` or `FRONTEND_URL/login?error=github`. The session cookie only works when the frontend and backend are the same site (`localhost`, not `127.0.0.1`) and CORS allows credentials from the exact frontend origin. If you change the backend auth or the CORS origins, check `auth.ts`, the interceptor and `CORS_ORIGINS` as well.

## Keeping docs in sync

The README is the documentation, covering setup, `.env`, routes and the architecture. If a change affects any of these, update the README **in the same PR**. If the README and the code disagree, the code wins: fix the README, or file an issue if the code is wrong.

## Filing issues

If you find a bug, a gap or a docs/code mismatch outside the current task, **file it right away** with `gh issue create`. Don't silently fix it inside an unrelated change. Include the `file:line`, a concrete failure scenario and the expected behaviour. Mention the issue number in your summary or PR description.

Label every issue and PR (`--label` on `gh issue create` / `gh pr create`): one type (`bug`, `enhancement`, `documentation`), the area (`backend`, `frontend`), and `security` or `dependencies` where they apply. A PR carries the labels of the issue it closes. Create a new label only when none of these fits.

Assign every issue to whoever opens it. When you file one, that's the account `gh` is signed in as, so pass `--assignee @me` to `gh issue create`.

## Git & PR workflow

Every change (feature, fix or docs) starts from a GitHub issue and gets its own branch and PR:

1. **Issue:** use the existing one, or create it first with `gh issue create`. One issue = one branch = one PR.
2. **Branch from the issue:**
   ```bash
   gh issue develop <n> --name <type>/<n>-short-description --base main --checkout
   ```
   This links the branch under the issue's *Development* section. `<type>` is the Conventional Commit type (`feat`, `fix`, `docs`, …). Never commit directly to `main`.
3. **Commit** using Conventional Commits.
4. **Before the PR:** run `pytest` and, when the frontend changed, `npm test` in `frontend/`.
5. **PR:** put `Closes #<n>` in the description so the merge closes the issue and links it to the PR.
6. **Review and merge:** the `claude-code-review` workflow reviews each PR automatically. For an on-demand review or a question, write `@claude` in a PR or issue comment. Act on valid findings, then merge with `gh pr merge <n> --merge --delete-branch`.

No confirmation is needed in this repo to commit, push, open or merge your own PRs (approved by the owner). Force-push and history rewrites still need explicit approval.

Gotchas for the review workflow:

- It does not review PRs that change `.github/workflows/claude*.yml`, because the action only runs when the workflow file matches `main`.
- It skips PRs that Claude has already commented on. Use `@claude` to get a re-review.
