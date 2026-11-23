# Backend guide

The FastAPI app in `backend/app/`: what each module does and how to extend it. How the pieces work together is in [architecture.md](architecture.md), the routes in [api.md](api.md).

## Stack

FastAPI, SQLAlchemy on SQLite, Pydantic v2, PyJWT, httpx (calls to GitHub), cryptography (Fernet), python-dotenv. Tests with pytest.

## Modules

| Module | Responsibility |
| --- | --- |
| `main.py` | The app: CORS, JWT creation and validation, the GitHub sign-in flow, every route, and the exception handlers. Runnable directly (`python backend/app/main.py`) with reload. |
| `config.py` | Loads `.env` and holds every setting. Required settings raise at import, so the app doesn't start half-configured. |
| `database.py` | Engine (`check_same_thread=False`, because FastAPI runs requests in a thread pool), `SessionLocal` per request, `Base`. |
| `models.py` | SQLAlchemy models: `User`, `HiddenScope`, `ShownLabel`. |
| `schemas.py` | Pydantic models for every response and request body. |
| `github.py` | The HTTP calls to GitHub: authorize URL with PKCE, code exchange, token refresh, user, installations, GraphQL. Raises `GitHubError` (and `GitHubTokenRejected` for a 401). |
| `github_tokens.py` | `call_as_user`: runs a GitHub call with the user's token, refreshing it when needed under a per-user lock; raises `SignInRequired` when the tokens can't be renewed. `store_tokens` stores a token pair encrypted. |
| `crypto.py` | `encrypt_token` / `decrypt_token` (Fernet, `TOKEN_ENCRYPTION_KEY`). |
| `overview.py` | The GraphQL searches behind `/overview`, the shared item fragment and the helpers that turn GitHub's nodes into items (CI state, checks, reviewers). |
| `lists.py` | One list page by page (`/lists/{name}`), reusing `overview.py`'s searches and item helpers. |
| `overview_filters.py` | Read and replace the user's stored filters. |
| `org_overview.py` | The four team searches behind `/orgs/{organization}/overview`. |

`backend/fake_github_server/` is a stand-in for GitHub for local development ([development.md](development.md#fake-github)), not imported by the app: `data.py` (the made-up items), `search.py` (GitHub's search qualifiers Hoot uses), `nodes.py` (items as GraphQL nodes with every field of Hoot's fragments), `server.py` (the endpoints) and `__main__.py` (starts it together with the backend). `config.py`'s `GITHUB_URL` and `GITHUB_API_URL` point the backend at it.

`backend/setup_github_app.py` is a standalone one-time script (not imported by the app) that registers the GitHub App via GitHub's manifest flow on `localhost:8000` and writes the credentials and two new random keys to `.env`, never overwriting existing values.

## Errors

`main.py` turns the two exceptions from the GitHub layer into responses:

- `SignInRequired` → `401` that also clears the session cookie
- `GitHubError` → `502`

Routes don't catch them themselves.

## Adding a route that asks GitHub

1. Put the query or call in its own module (or `github.py` for a new REST call), taking an `httpx.Client` and an access token.
2. In `main.py`, depend on `get_current_user`, `get_db` and `get_github_client`, and run the call through `github_tokens.call_as_user(db, client, user, lambda token: ...)`.
3. Add the response model to `schemas.py`.
4. Test it with the `fake_github` fixture (below), including the `401`/`502` paths if the route has its own.
5. If it uses a new GraphQL field or search qualifier, add it to the fake GitHub (`backend/fake_github_server/nodes.py`, `search.py`); `test_fake_github_server.py` fails otherwise.
6. Document it in [api.md](api.md), and add it to the demo backend (`frontend/src/app/demo/demo-backend.ts`) if the frontend uses it.

## Tests

`backend/tests/`, run with `pytest` from the repo root.

- `conftest.py` sets every required setting, points the database at a temporary SQLite file, and provides the fixtures `client` (a `TestClient`), `user` (a signed-in user) and `fake_github`.
- `fake_github.py` replaces the `httpx.Client` behind `get_github_client`, so tests script GitHub's answers and never call the real GitHub.
- One file per area: `test_auth.py` (sessions), `test_github_auth.py` (sign-in flow), `test_overview.py`, `test_lists.py`, `test_org_overview.py`, `test_overview_filters.py`, `test_github_installations.py`, `test_token_refresh_race.py`, `test_config.py`, `test_setup_github_app.py`, and `test_fake_github_server.py`, which signs in and loads every route against the fake GitHub.

## Database changes

Tables are created on import with `Base.metadata.create_all`; there are no migrations. A new table needs nothing. A changed or new column needs a fresh database (delete `backend/hoot.db`) or a manual `ALTER`, so mention it in the PR.
