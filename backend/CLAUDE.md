# Backend (CLAUDE.md)

Rules for working in `backend/`. The full guide is `docs/backend.md`; routes are in `docs/api.md`, the sign-in and session in `docs/architecture.md`.

## Layout

A small FastAPI app in `app/`:

- `config.py` loads `.env` and holds every setting; required ones raise at import. A new setting also goes into `.env.example` and `docs/configuration.md`.
- `main.py` holds CORS, JWT creation and validation (PyJWT), the GitHub sign-in flow, all routes and the exception handlers: `/auth/github/login`, `/auth/github/callback`, `/logout`, `/profile`, `/overview`, `/lists/{name}`, `/overview/filters` (GET and PUT), `/orgs/{organization}/overview`, `/github/installations` (all but the first three protected).
- `github.py` makes the HTTP calls to GitHub through an `httpx.Client` that routes get via the `get_github_client` dependency.
- `github_tokens.py` (`call_as_user`, `store_tokens`), `crypto.py` (Fernet), `overview.py` (the `/overview` searches and item helpers), `lists.py` (`/lists/{name}`), `overview_filters.py`, `org_overview.py` (team view), `models.py`, `schemas.py`, `database.py`.
- `setup_github_app.py` (next to `app/`) is a standalone one-time script, not imported by the app. It registers the GitHub App via the manifest flow and writes the credentials and two random keys to `.env`, never overwriting existing values.

## Rules

- **Every GitHub call on a user's behalf goes through `github_tokens.call_as_user`**, which refreshes expired tokens (one at a time per user) and raises `SignInRequired` when they can't be renewed. The handlers in `main.py` turn that into a 401 that clears the session, and any `GitHubError` into a 502. Routes don't catch them.
- **GitHub tokens** are stored only through `crypto.encrypt_token`, and never returned, logged or put into an error message.
- **Sign-in security** (`docs/specs/sign-in-security.md`): `state` and PKCE in the signed short-lived cookie `hoot_oauth`, redirect only to the fixed `FRONTEND_URL`, the session JWT (`sub` = user id as a string, `auth_time`, `exp`) only as the HttpOnly cookie `hoot_session`, users matched by GitHub id. `get_current_user` reads only that cookie (no `Authorization` header).
- **A GitHub App user token only reaches accounts where the app is installed**, so an empty result can mean "not installed" (`/github/installations`).
- **Team view:** work items and team totals only. Never add counts, rankings or metrics per person (works council and GDPR, `docs/specs/team-view.md`).
- **No migrations:** tables are created with `Base.metadata.create_all` on import. A new table needs nothing; a changed column needs a fresh DB or a manual `ALTER`, so say so in the PR.
- **A route or response change** also updates `schemas.py`, the frontend's types in `frontend/src/app/services/`, the demo backend in `frontend/src/app/demo/` and `docs/api.md`.

## Tests

`pytest` from the repo root. `tests/conftest.py` sets every required setting and a temporary SQLite database before importing the app, and provides `client`, `user` and `fake_github`. `fake_github` (`tests/fake_github.py`) replaces the `httpx.Client`, so tests never call the real GitHub. One test file per area; add tests for both the success and the `401`/`502` paths of a new GitHub route.
