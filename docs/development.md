# Local development

Everything you need to run, test and change Hoot on your machine. The main dev machine is Windows; the commands work the same on macOS and Linux unless noted.

- [Prerequisites](#prerequisites)
- [First-time setup](#first-time-setup)
- [GitHub App](#github-app)
- [Running Hoot](#running-hoot)
- [Demo mode](#demo-mode)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Python 3.12** (what CI uses)
- **Node.js 24 LTS**, at least 24.15. Angular 22 supports `^22.22.3 || ^24.15.0 || >=26`, but Node 25+ breaks `localStorage` in the jsdom unit tests.
- A GitHub account

## First-time setup

From the repo root:

```
python -m venv venv
venv\Scripts\activate              # Windows
source venv/bin/activate           # macOS / Linux
pip install -r backend/requirements-dev.txt
python backend/setup_github_app.py
cd frontend
npm install
```

`backend/requirements-dev.txt` is the runtime dependencies (`backend/requirements.txt`) plus pytest. `setup_github_app.py` creates your GitHub App and `.env` (next section).

## GitHub App

Hoot signs users in through a GitHub App. Everyone who runs their own Hoot needs their own app, because its client secret must stay private. Users of a running Hoot only sign in with their own GitHub account. Why it's a GitHub App and not an OAuth App: [specs/github-app.md](specs/github-app.md).

### Quick setup (recommended)

With the venv active and the backend stopped, run once:

```
python backend/setup_github_app.py
```

It opens `http://localhost:8000` in the browser and sends GitHub a description of the app ([manifest](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)) with the settings listed under *Manual setup*. *Expire user authorization tokens* can't be set in a manifest; it's on by default, and Hoot works either way.

On GitHub, check the name and click **Create GitHub App**. GitHub sends you back, and the script writes `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_APP_SLUG` to `.env`, plus a new random `SECRET_KEY` and `TOKEN_ENCRYPTION_KEY` if they are missing. Existing settings are never overwritten. If `.env` already has a `GITHUB_CLIENT_ID`, the script only adds missing keys; remove the `GITHUB_*` lines to create a new app.

Then start Hoot, sign in, and install the app on your account from the banner or the *GitHub access* page.

### Manual setup

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**
2. **GitHub App name:** must be unique on GitHub, e.g. `Hoot dev <your-username>`
3. **Homepage URL:** `http://localhost:4200`
4. Under *Identifying and authorizing users*:
   - **Redirect URI:** `http://localhost:8000/auth/github/callback`
   - **Allow wildcard matching:** off
   - **Expire user authorization tokens:** on
   - **Request user authorization (OAuth) during installation:** **off**. With it on, GitHub sends the browser to the callback right after installing, without Hoot's `state`, and the callback rejects that (`400`). Signing in always starts from Hoot's "Sign in with GitHub" button.
   - **Enable Device Flow:** off
5. *Post installation*: **Setup URL** `http://localhost:4200/` and **Redirect on update** on, so GitHub sends the user back to Hoot after installing the app or changing its repositories
6. **Webhook:** uncheck *Active*
7. **Repository permissions:** Issues, Pull requests, Checks and Commit statuses → *Read-only* (Metadata is set automatically); everything else stays *No access*. Checks and Commit statuses are needed for the CI status of pull requests. After adding permissions to an existing app, accept them on the installation (GitHub → Settings → Applications → Installed GitHub Apps).
8. **Where can this GitHub App be installed?** *Only on this account* for development; *Any account* if it should also be installed on organizations
9. Create the app, then **Generate a new client secret** (GitHub shows it only once)
10. Put the **Client ID** and the client secret into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and the app's URL name as `GITHUB_APP_SLUG` (see [configuration.md](configuration.md))
11. Install the app on your account: after signing in, a banner and the *GitHub access* page link to GitHub's install page.

### Who can install it where

Hoot only sees repositories in accounts where the app is installed. Members who aren't owners of an organization can request the app there, and GitHub asks the owners to approve it. Outside collaborators (access to a repository, but no organization membership) can't: they have to ask an owner of the organization to install it.

Hoot can't list the organizations where it's still missing. A GitHub App's user token only searches accounts where the app is installed, and `GET /user/orgs` only returns organization *memberships*, never organizations where the user is just a collaborator (tested with a real token in #96). The *GitHub access* page lists where Hoot *is* installed, and GitHub's install page offers every account the user can install or request it for.

## Running Hoot

Backend (creates the SQLite database on first start and restarts when backend code changes):

```
python backend/app/main.py
```

This works from any working directory, and so does the IDE's Run button on `main.py`. `python -m backend.app.main` and `uvicorn backend.app.main:app --reload` (both from the repo root) start the same server.

- API: `http://localhost:8000`
- Interactive API reference (built into FastAPI): `http://localhost:8000/docs`

Frontend, in a second terminal:

```
cd frontend
npm start
```

Open `http://localhost:4200` (not `127.0.0.1`, see [configuration.md](configuration.md#the-frontend)).

## Demo mode

To check the UI without the backend, GitHub or a sign-in:

```
cd frontend
npm run demo
```

This starts the frontend at `http://localhost:4200` with made-up data. You are signed in as `demo-user`. An HTTP interceptor answers every backend request in the browser, after a short delay so the loading states show. How it works: [frontend/architecture.md](frontend/architecture.md#demo-mode).

Pick a scenario with `?scenario=` in the URL. It is kept for the browser tab until you pick another:

| Scenario | Shows |
| --- | --- |
| `full` (default) | Items in all four lists across several owners; failing, running and passing CI with single checks; a draft; reviewers, labels and milestones; 62 assigned issues (so the overview says "50+" and the list page needs *Load more*); the team views `/orgs/demo-labs` and `/orgs/demo-orbit` |
| `empty` | Installed, but nothing waiting |
| `not-installed` | No installation, so the install banner shows |
| `errors` | Every GitHub call fails with 502, so the error boxes show |

Filters, sorting, grouping and *Load more* behave like the real backend; filters are kept until the page reloads. All names are fictional (`demo-…`). Links to GitHub lead nowhere useful, and *Sign out* followed by *Sign in with GitHub* needs the real backend.

## Tests

| What | Command | Where |
| --- | --- | --- |
| Backend | `pytest` (repo root) | `backend/tests/` |
| One backend test | `pytest backend/tests/test_auth.py::test_profile_returns_the_logged_in_user` | |
| Frontend | `npm test` (in `frontend/`) | `*.spec.ts` next to the code |
| Frontend build | `npm run build` (in `frontend/`) | |

The backend tests use a temporary SQLite database (not `backend/hoot.db`) and never call the real GitHub: the `fake_github` fixture (`backend/tests/conftest.py`, `fake_github.py`) answers GitHub's API instead, and `conftest.py` sets every required setting. Frontend tests run with Vitest and jsdom; `src/test-providers.ts` registers the icons for every spec.

The `Tests` workflow (`.github/workflows/tests.yml`) runs both on every pull request and on pushes to `main`. Don't merge while it is red.

There is no linter. Prettier formats the frontend (`frontend/.prettierrc`); run it on the files you changed:

```
cd frontend
npx prettier --write <files>
```

## Troubleshooting

| Problem | Cause and fix |
| --- | --- |
| Backend stops with `SECRET_KEY is not set` (or another variable) | `.env` is missing or incomplete. Run `python backend/setup_github_app.py` or fill it from `.env.example`. |
| Signed in, but every request answers `401` | You opened `127.0.0.1:4200`: the cookie belongs to `localhost`. Use `http://localhost:4200`. On Safari also set `COOKIE_SECURE=false`. |
| Sign-in ends on the login page with an error, or the callback answers `400` | The callback came without Hoot's `state`, typically because *Request user authorization (OAuth) during installation* is on in the GitHub App. Turn it off and sign in from Hoot's button. |
| Signed in, but every list is empty | The GitHub App isn't installed anywhere, or not on the account that owns the repositories. See the *GitHub access* page. |
| No CI status on pull requests | The app lacks the *Checks* and *Commit statuses* permissions, or the installation hasn't accepted them yet. |
| Errors after changing a model in `models.py` | There are no migrations. Delete `backend/hoot.db` (users sign in again) or `ALTER` the table by hand. New tables need nothing. |
| Frontend tests fail with `localStorage` errors | Node 25 or newer. Use Node 24 LTS. |
