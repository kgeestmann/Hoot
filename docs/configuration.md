# Configuration

The backend reads its settings from a `.env` file in the repo root (`backend/app/config.py`). `.env` is gitignored, because it holds secrets. [`.env.example`](../.env.example) lists every variable with its default.

The quickest way to a working `.env` is the setup script, which creates your GitHub App and writes the credentials and both keys (see [development.md](development.md#github-app)):

```
python backend/setup_github_app.py
```

To write it by hand, copy the example and fill in the required values:

```
cp .env.example .env
```

## Required

The backend refuses to start if one of these is missing or empty.

| Variable | What it is |
| --- | --- |
| `SECRET_KEY` | Signs the session JWTs. At least 32 bytes, otherwise the backend refuses to start. Anyone who knows or guesses it can sign sessions for any user, so use a random one (command below). |
| `TOKEN_ENCRYPTION_KEY` | Fernet key that encrypts the users' GitHub tokens in the database, so a copied `hoot.db` alone gives no access to GitHub accounts. Deliberately separate from `SECRET_KEY`. Changing it makes the stored tokens unreadable, and users have to sign in again. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Credentials of your GitHub App. |
| `GITHUB_APP_SLUG` | URL name of the GitHub App, as in `https://github.com/apps/<slug>`. Hoot links to `https://github.com/apps/<slug>/installations/new` so users can install it. |

Create the keys in the venv:

```
python -c "import secrets; print(secrets.token_urlsafe(32))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Optional

| Variable | Default | What it does |
| --- | --- | --- |
| `GITHUB_CALLBACK_URL` | `http://localhost:8000/auth/github/callback` | Must match the callback URL of the GitHub App. |
| `FRONTEND_URL` | `http://localhost:4200` | Where the browser lands after signing in. Fixed, so the callback can't be used as an open redirect. |
| `CORS_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200` | Comma-separated frontend origins allowed to call the API with the session cookie. |
| `ALGORITHM` | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | How long a session lasts **without requests**. Requests in the second half of that time renew it (sliding session), so an active user stays signed in. |
| `SESSION_MAX_DAYS` | `7` | However active, a session ends this many days after signing in, so a stolen cookie can't be kept alive forever. |
| `COOKIE_SECURE` | `true` | `true` or `false`: whether the session cookie gets the `Secure` flag. Chrome, Edge and Firefox accept Secure cookies on `http://localhost`, so local development works with the default. Safari doesn't; set `false` there. |
| `DATABASE_URL` | `sqlite:///<repo>/backend/hoot.db` | SQLAlchemy connection string. `docker-compose.yml` sets `sqlite:////data/hoot.db` on a volume. |
| `ROOT_PATH` | empty | Path prefix under which a reverse proxy serves the backend, with the proxy stripping it (`docker-compose.yml` sets `/api`). Must start with `/`. The OAuth cookie path and `/docs` include it. |

## Docker setup only

| Variable | What it does |
| --- | --- |
| `DOMAIN` | The domain Hoot is served on, e.g. `hoot.example.com`. Caddy gets the HTTPS certificate for it. Required by `docker-compose.yml`. |

The production values for the other settings are in [deployment.md](deployment.md#configuration).

## The frontend

The frontend has no configuration file. The backend URL is the constant `API_URL`: `http://localhost:8000` in `frontend/src/app/api.ts` for development, and `/api` in `api.production.ts`, which the production build uses instead (`fileReplacements` in `angular.json`).

Open the frontend as `http://localhost:4200`, not `127.0.0.1`: the session cookie belongs to `localhost`, and only the same site gets it. If you change `FRONTEND_URL` or `CORS_ORIGINS`, the frontend's origin must still be in `CORS_ORIGINS` exactly.
