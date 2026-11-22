# Hoot

One page for everything that is waiting on you on GitHub: assigned issues, your open pull requests, review requests and mentions, across all your repositories and organizations.

Built with **FastAPI**, **SQLite**, **Angular** and **JWT** sessions.

> **Status:** early. Signing in with GitHub, the overview page with filters and a team view per organization work (see the open issues for what's next).

---

# Architecture Overview

This project consists of three main components:

* **Backend**: FastAPI application handling the GitHub sign-in, sessions and database access
* **Frontend**: Angular application providing sign-in and profile UI
* **Database**: SQLite file (`backend/hoot.db`) for users and their (encrypted) GitHub tokens, created automatically on first start

Users sign in with their GitHub account via a **GitHub App** (OAuth). Hoot then keeps its own session as a **JWT** in an HttpOnly cookie.

Flow:

1. User clicks "Sign in with GitHub" in the Angular frontend
2. The backend sends the browser to GitHub, the user authorizes Hoot
3. GitHub sends the browser back to the backend, which exchanges the code for the user's GitHub tokens and stores them encrypted
4. FastAPI sets the JWT as an HttpOnly session cookie (`hoot_session`) and redirects to the frontend
5. The browser sends the cookie with every request to the backend
6. FastAPI validates the token and returns protected data

---

# Project Structure

```
Hoot
│
├── backend
│   ├── setup_github_app.py  one-time local setup: creates the GitHub App, fills .env
│   └── app
│       ├── main.py        routes, sessions, GitHub sign-in flow
│       ├── github.py      calls to GitHub (authorize URL, tokens, user, GraphQL)
│       ├── github_tokens.py  storing and refreshing the users' GitHub tokens
│       ├── overview.py    GraphQL searches behind GET /overview
│       ├── overview_filters.py  the owners/repositories a user hid from the overview
│       ├── org_overview.py  GraphQL searches behind GET /orgs/{organization}/overview
│       ├── crypto.py      encryption of the stored GitHub tokens
│       ├── config.py      settings from .env
│       ├── models.py
│       ├── schemas.py
│       └── database.py
│
├── frontend
│   └── src/app
│       ├── pages
│       │   ├── overview   start page: the four lists and the GitHub access card
│       │   ├── organization   team view of one organization (/orgs/:organization)
│       │   ├── login
│       │   └── profile
│       │
│       ├── services
│       │   ├── auth.ts
│       │   ├── github-access.ts
│       │   ├── overview.ts
│       │   ├── overview-filters.ts
│       │   ├── organizations.ts
│       │   └── session-interceptor.ts
│       │
│       └── api.ts         backend URL
│
├── .env
└── README.md
```

---

# Backend (FastAPI)

The backend handles:

* the GitHub sign-in (OAuth with state and PKCE)
* encrypted storage of the users' GitHub tokens
* JWT session cookies
* protected endpoints
* database communication

Main technologies:

* FastAPI
* SQLAlchemy
* SQLite
* PyJWT (JWT)
* httpx (calls to GitHub)
* cryptography (Fernet encryption of GitHub tokens)
* dotenv (environment variables)

---

# Python Environment (venv)

Create a virtual environment:

```
python -m venv venv
```

Activate it:

Windows

```
venv\Scripts\activate
```

Install dependencies (the runtime dependencies plus pytest):

```
pip install -r backend/requirements-dev.txt
```

`backend/requirements.txt` holds only what the backend needs at runtime, e.g. for a production install.

---

# GitHub App

Hoot signs users in through a GitHub App. Everyone who runs their own Hoot needs their own app (its client secret must stay private). Users of a running Hoot only sign in with their own GitHub account.

## Quick setup (recommended)

With the venv active and the backend stopped, run once:

```
python backend/setup_github_app.py
```

It opens `http://localhost:8000` in the browser and sends GitHub a description of the app ([manifest](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)) with the settings below (*Expire user authorization tokens* can't be set in a manifest; it's on by default, and Hoot works either way). On GitHub, check the name and click **Create GitHub App**. GitHub sends you back, and the script writes `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_APP_SLUG` to `.env`, plus a generated `SECRET_KEY` and `TOKEN_ENCRYPTION_KEY` if they are missing. Existing settings are never overwritten. If `.env` already has a `GITHUB_CLIENT_ID`, the script only adds missing keys; remove the `GITHUB_*` lines to create a new app.

Then start Hoot (see *Running the Project*), sign in, and install the app on your account from Hoot's overview page.

## Manual setup

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**
2. **GitHub App name:** must be unique on GitHub, e.g. `Hoot dev <your-username>`
3. **Homepage URL:** `http://localhost:4200`
4. Under *Identifying and authorizing users*:
   * **Redirect URI:** `http://localhost:8000/auth/github/callback`
   * **Allow wildcard matching:** off
   * **Expire user authorization tokens:** on
   * **Request user authorization (OAuth) during installation:** **off**. With it on, GitHub sends the browser to the callback right after installing, without Hoot's `state`, and the callback rejects that (`400`). Signing in always starts from Hoot's "Sign in with GitHub" button.
   * **Enable Device Flow:** off
5. *Post installation*: **Setup URL** `http://localhost:4200/` and **Redirect on update** on, so GitHub sends the user back to Hoot after installing the app or changing its repositories
6. **Webhook:** uncheck *Active*
7. **Repository permissions:** Issues, Pull requests, Checks and Commit statuses → *Read-only* (Metadata is set automatically); everything else stays *No access*. Checks and Commit statuses are needed for the CI status of your pull requests on the overview. After adding permissions to an existing app, accept them on the installation (GitHub → Settings → Applications → Installed GitHub Apps)
8. **Where can this GitHub App be installed?** *Only on this account* for development; *Any account* if it should also be installed on organizations
9. Create the app, then **Generate a new client secret** (GitHub shows it only once)
10. Put the **Client ID** and the client secret into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and the app's URL name as `GITHUB_APP_SLUG` (the last part of its public page `https://github.com/apps/<slug>`)
11. Install the app on your account: after signing in, Hoot's overview page links to GitHub's install page. Hoot only sees repositories in accounts where the app is installed. Members who aren't owners of an organization can request the app there, and GitHub asks the owners to approve it.

---

# Environment Variables (.env)

Example `.env` file:

```
SECRET_KEY=<output of the SECRET_KEY command below>
TOKEN_ENCRYPTION_KEY=<output of the TOKEN_ENCRYPTION_KEY command below>
GITHUB_CLIENT_ID=<Client ID of your GitHub App>
GITHUB_CLIENT_SECRET=<client secret of your GitHub App>
GITHUB_APP_SLUG=<URL name of your GitHub App>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
SESSION_MAX_DAYS=7
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
COOKIE_SECURE=true
```

Explanation:

SECRET_KEY
Used to sign JWT tokens. **Required** — the backend refuses to start without it or if it is shorter than 32 bytes. Anyone who knows or guesses it can sign tokens for any user, so generate a random one:

```
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

TOKEN_ENCRYPTION_KEY
Fernet key that encrypts the users' GitHub tokens in the database, so a copied `hoot.db` alone gives no access to GitHub accounts. **Required**, and deliberately separate from `SECRET_KEY`. Generate it in the venv:

```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Changing it makes the stored GitHub tokens unreadable; users then have to sign in again.

GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
Credentials of the GitHub App (see *GitHub App*). **Required.**

GITHUB_APP_SLUG
URL name of the GitHub App, as in `https://github.com/apps/<slug>`. Hoot links to `https://github.com/apps/<slug>/installations/new` so users can install it. **Required.**

GITHUB_CALLBACK_URL
Must match the callback URL of the GitHub App. Default: `http://localhost:8000/auth/github/callback`.

FRONTEND_URL
Where the browser lands after signing in. Default: `http://localhost:4200`.

ALGORITHM
JWT encryption algorithm. Default: `HS256`.

ACCESS_TOKEN_EXPIRE_MINUTES
How long a Hoot session lasts **without requests**. Requests in the second half of that time renew the session (see *Token Validation*), so an active user stays signed in. Default: `60`.

SESSION_MAX_DAYS
However active, a session ends this many days after signing in, so a stolen cookie can't be kept alive forever. Default: `7`.

CORS_ORIGINS
Comma-separated list of frontend origins allowed to call the API. Default: `http://localhost:4200,http://127.0.0.1:4200`.

COOKIE_SECURE
`true` or `false`: whether the session cookie gets the `Secure` flag (HTTPS only). Default: `true`. Chrome, Edge and Firefox accept Secure cookies on `http://localhost`, so local development works with the default. Safari doesn't; set `false` there.

DATABASE_URL
Optional SQLAlchemy connection string. Default: the SQLite file `backend/hoot.db`.

---

# Database Configuration

File: `database.py`

Responsible for:

* database connection
* session creation
* SQLAlchemy base model

Key components:

create_engine
Creates the SQLite connection (`check_same_thread=False`, because FastAPI handles requests in a thread pool).

SessionLocal
Creates a database session for each request.

Base
Base class for database models.

Connection string: read from `DATABASE_URL` in `.env` (see *Environment Variables*). Default:

```
sqlite:///<repo>/backend/hoot.db
```

The file and the `users` table are created automatically on first start. There are no migrations: after a model change, delete the file to start with an empty database. **A `hoot.db` from before the overview API (#25) must be deleted**, because `github_access_token` may be empty now; signing in again creates the user anew.

---

# Database Model

File: `models.py`

Defines the user table. A user is identified by the GitHub account's numeric id, because a GitHub login can be renamed and then taken by someone else.

Table structure:

| Column                          | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| id                              | Primary key (the `sub` of Hoot's session JWT)  |
| github_id                       | Unique numeric GitHub user id                  |
| login                           | GitHub login, updated on every sign-in         |
| github_access_token             | Encrypted GitHub user access token; empty after GitHub rejected it |
| github_access_token_expires_at  | Unix timestamp, or empty if it doesn't expire  |
| github_refresh_token            | Encrypted refresh token, if GitHub issued one  |
| github_refresh_token_expires_at | Unix timestamp                                 |

GitHub tokens are **never stored in plain text** and never leave the backend.

Two tables hold the overview filters, one row per entry:

| Table           | Columns                   | Holds                                                         |
| --------------- | ------------------------- | ------------------------------------------------------------- |
| `hidden_scopes` | `id`, `user_id`, `scope`  | Hidden owners (`octo-org`) and repositories (`octo-org/hoot`), lowercase |
| `shown_labels`  | `id`, `user_id`, `label`  | Labels picked in the label filter, lowercase                  |

New tables are created on the next start, so they need no fresh database.

---

# Pydantic Schemas

File: `schemas.py`

UserResponse

Returned by `/profile`.

```
id
login
```

Overview

Returned by `/overview`: four lists (`assigned_issues`, `pull_requests`, `review_requests`, `mentions`) of items with

```
kind          "issue" or "pull_request"
title
repository    owner/name
number
url
updated_at
labels        list of { name, color }; color is GitHub's six hex digits, e.g. "d73a4a" (first 10 labels)
```

Next to the four lists, `totals` holds one entry per list:

```
total         how many items GitHub found
has_more      true when that's more than the list holds (at most 50)
search_url    the same search on github.com, with every match
```

OverviewFilters

Returned and accepted by `/overview/filters`.

```
hidden    list of owners ("octo-org") or repositories ("octo-org/hoot") to hide, at most 500
labels    list of label names to show only (empty: every label), at most 100, each at most 50 characters
```

Entries are trimmed, lowercased (GitHub names are case-insensitive), de-duplicated and sorted. Anything else answers `422`. A request without `labels` shows every label.

GitHubAccess

Returned by `/github/installations`.

```
install_url      GitHub's page for installing the app on more accounts
installations    list of { account, account_type ("User" or "Organization"), all_repositories, settings_url }
```

Items in `pull_requests` of the overview also carry `ci_status` (GitHub's `SUCCESS`, `FAILURE`, `PENDING`, `ERROR`, `EXPECTED`, or `null` without checks) and `review_decision` (`APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, or `null`).

---

# FastAPI Application

File: `main.py`

This file contains:

* application initialization
* middleware
* session and GitHub sign-in logic
* API routes

---

# CORS Middleware

```
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
)
```

Purpose:

Allows the Angular frontend to call the FastAPI backend with the session cookie. Without this, browsers block requests.

---

# GitHub Sign-in

The OAuth flow follows the security requirements in issue #44:

* **State:** `/auth/github/login` creates a random `state` and a PKCE code verifier and stores both in the short-lived, signed, HttpOnly cookie `hoot_oauth` (10 minutes, only sent to `/auth/github`). The callback rejects a missing or mismatched state with `400`, and the cookie is dropped after use, so a state cannot be replayed.
* **PKCE:** the authorize request carries an S256 `code_challenge`, the code exchange the matching `code_verifier`.
* **No open redirect:** after the sign-in the browser always goes to `FRONTEND_URL` (or `FRONTEND_URL/login?error=github` if it failed or was cancelled). Redirect parameters are ignored.
* **No token in a URL:** the Hoot session is handed over as an HttpOnly cookie, never as a query parameter.
* **Encrypted tokens:** GitHub access and refresh tokens are stored encrypted with `TOKEN_ENCRYPTION_KEY` (`crypto.py`).

GitHub user tokens expire after 8 hours; the refresh token lasts 6 months. Every call to GitHub on the user's behalf goes through `github_tokens.call_as_user`:

* If the access token has expired (or expires within a minute), it is refreshed first, and the new pair is stored encrypted.
* If GitHub still answers `401`, the token is refreshed once more and the call retried.
* If there is no refresh token, it has expired, GitHub rejects it, or the retried call gets `401` again (e.g. the user revoked Hoot on GitHub), the stored tokens are deleted, the session cookie is cleared and the route answers `401`. The frontend then sends the user to the sign-in.
* If GitHub can't be reached or answers with an error, the route answers `502` and the tokens stay.
* Refresh tokens work only once, so parallel requests of one user refresh one at a time (a lock per user): a request that waited uses the token the other one just stored instead of refreshing again. The lock covers one backend process, which is how Hoot runs.

---

# JWT Authentication

JWT tokens are created after a successful sign-in.

Function:

```
create_access_token()
```

Steps:

1. Copy user data
2. Add `auth_time`, the time of the sign-in (now, unless a renewal passes the original one)
3. Add the expiration: `ACCESS_TOKEN_EXPIRE_MINUTES` from now, but at most `SESSION_MAX_DAYS` after `auth_time`
4. Encode using SECRET_KEY
5. Return signed token

Example token payload:

```
{
  "sub": "1",
  "auth_time": 1709996400,
  "exp": 1710000000
}
```

---

# Token Validation

Function:

```
get_current_user()
```

Steps:

1. Read the token from the `hoot_session` cookie
2. Decode JWT (requires `exp`, `sub` and `auth_time`)
3. Reject sessions older than `SESSION_MAX_DAYS` since `auth_time`
4. Extract user id
5. Query database
6. If less than half of `ACCESS_TOKEN_EXPIRE_MINUTES` is left, set a fresh `hoot_session` cookie with the same `auth_time` (sliding session)
7. Return authenticated user

A missing, invalid or expired cookie returns `401`. An `Authorization` header is not accepted. Sessions from before the sliding session (no `auth_time`) are rejected once, so users sign in again.

---

# API Routes

Root

```
GET /
```

Returns a simple status message: `{"message": "Hoot backend is running."}`

---

Start the GitHub sign-in

```
GET /auth/github/login
```

Opened by the browser (a link, not an API call). Sets the `hoot_oauth` cookie and redirects (`302`) to GitHub's authorize page.

---

GitHub callback

```
GET /auth/github/callback?code=…&state=…
```

GitHub sends the browser here after the user authorized Hoot.

Process:

1. Check `state` against the `hoot_oauth` cookie (`400` if missing, wrong or expired)
2. Exchange the code for the user's tokens (with client secret and PKCE verifier)
3. Load the GitHub user
4. Create or update the user and store the tokens encrypted
5. Set the session cookie and redirect to `FRONTEND_URL`

```
Set-Cookie: hoot_session=<jwt>; HttpOnly; Max-Age=3600; Path=/; SameSite=lax; Secure
```

If the user cancelled on GitHub or GitHub rejected the code, it redirects to `FRONTEND_URL/login?error=github` without a session.

---

Logout

```
POST /logout
```

Deletes the session cookie. Returns `204 No Content`, also when nobody was logged in.

---

Profile (Protected Route)

```
GET /profile
```

Requires a valid session cookie.

Returns:

```
{
  "id": 1,
  "login": "octocat"
}
```

---

Overview (Protected Route)

```
GET /overview
```

Requires a valid session cookie. Runs four GitHub searches as the user in one GraphQL query, each limited to the 50 most recently updated results (`totals` says when a list is cut off), and only covering repositories where the GitHub App is installed:

| List              | GitHub search                                     |
| ----------------- | ------------------------------------------------- |
| `assigned_issues` | `is:open is:issue assignee:@me archived:false`    |
| `pull_requests`   | `is:open is:pr author:@me archived:false`         |
| `review_requests` | `is:open is:pr review-requested:@me archived:false` |
| `mentions`        | `is:open mentions:@me archived:false`             |

Mentions whose latest comment comes from a bot (or, without comments, that a bot opened) are left out. The response shape is described under *Pydantic Schemas*.

Returns `401` (and clears the session cookie) when the GitHub tokens can't be renewed, and `502` when GitHub fails; see *GitHub Sign-in*.

---

Organization team view (Protected Route)

```
GET /orgs/{organization}/overview
```

Requires a valid session cookie. The organization must be one where the GitHub App is installed for the user (otherwise `404`; an invalid name gets `422`). Runs four searches in the organization with the user's token, each `is:open archived:false`, with GitHub's total, up to 20 items and a link to the full search on github.com:

| List                 | Search                                   | Order                       |
| -------------------- | ---------------------------------------- | --------------------------- |
| `waiting_for_review` | `is:pr review:required -is:draft`        | oldest first                |
| `failing_ci`         | `is:pr status:failure`                   | recently updated first      |
| `unassigned_issues`  | `is:issue no:assignee`                   | oldest first                |
| `stale`              | `updated:<today-60 days` (issues and PRs) | least recently updated first |

```
{
  "organization": "Octo-Org",
  "stale_after_days": 60,
  "waiting_for_review": { "total": 3, "items": [ ... ], "search_url": "https://github.com/search?q=..." },
  "failing_ci": { ... }, "unassigned_issues": { ... }, "stale": { ... }
}
```

Items are like the overview's, plus `created_at`, `author` (`null` for deleted accounts), `assignees`, and `ci_status` / `review_decision` for pull requests. **Deliberately no statistics per person** (no counts, rankings or response times per person): in Germany such tools usually need works-council approval (§ 87 Abs. 1 Nr. 6 BetrVG) and fall under GDPR, see #28.

---

Overview filters (Protected Route)

```
GET /overview/filters
PUT /overview/filters
```

Requires a valid session cookie. `GET` returns the user's filters, `PUT` replaces them and returns them as stored:

```
{ "hidden": ["dipt-pa1469-ht26", "kgeestmann/old-repo"], "labels": ["bug"] }
```

The frontend applies the filters to the loaded overview; `/overview` itself always returns everything.

---

GitHub access (Protected Route)

```
GET /github/installations
```

Requires a valid session cookie. Lists the accounts where the GitHub App is installed and the user can use it (GitHub's `GET /user/installations`, first 100), plus the install URL:

```
{
  "install_url": "https://github.com/apps/<slug>/installations/new",
  "installations": [
    {
      "account": "octocat",
      "account_type": "User",
      "all_repositories": true,
      "settings_url": "https://github.com/settings/installations/1"
    }
  ]
}
```

Enterprise installations are left out. Errors as for `/overview`.

---

# Frontend (Angular)

The Angular frontend provides:

* Sign-in page
* Overview page with everything waiting on you, and where Hoot can see your repositories
* Profile page
* Auth service for API communication

Framework: Angular (standalone components)

Layout (`layout/sidenav`):

* **Navigation:** a Material nav list with icons: *Overview*, and under *Teams* every organization where Hoot is installed. The active page is tinted in the brand orange. At the bottom, an account button (the login's initial and the GitHub login) opens a menu with *Profile* and *Sign out*. The initial replaces the GitHub avatar, which would load from GitHub's servers and send every visitor's IP address there.
* **Top bar:** shows the current page's title (from the route's `title`, also used for the browser tab: "Overview · Hoot").
* **Responsive:** from 840 px wide (Material 3's "expanded" size) the navigation stays open beside the content. Below that it is a drawer behind a menu button in the top bar, and it closes once a page is chosen.
* **Icons:** Material Symbols Outlined as SVG, registered once in `icons.ts` and used as `<mat-icon svgIcon="…">`.
* Pages are lazy-loaded, so the first download only holds the app shell.

---

# Angular Pages

Login Page

```
/login
```

Shows a "Sign in with GitHub" button. It is a plain link to `/auth/github/login` on the backend, because the sign-in is a full page navigation to GitHub and back. With `?error=github` the page explains that the sign-in failed or was cancelled.

---

Overview Page

```
/
```

The start page after signing in (logged-out visitors go to `/login`, and `/login` sends logged-in users here). It loads `GET /overview` and `GET /github/installations` side by side:

* **Four tabs** (`mat-tab-group`): *My pull requests*, *Review requests*, *Assigned* and *Mentions*, each with the number of items it shows. The page opens on the first tab with items. When GitHub found more than the 50 loaded items, the tab ends with *Show all N on GitHub*. Each list is a Material nav list (`overview-section`), and every item is one clickable row to GitHub: the title, a line with kind, `owner/repo#number` and how long ago it was updated ("3 hours ago", `item/item-meta`), and a line of chips (`item/item-chips`):
  * **Status** of your pull requests: CI (`CI passing`, `CI failing`, `CI running`) and review (`Approved`, `Changes requested`, `Review required`), always as text with an icon (✓ check, ✕ close, 🕒 schedule) and a colour, never colour alone.
  * **Labels** in GitHub's colours. The text is dark or white, whichever has more contrast on the label colour (`item/label-colors.ts`), as on GitHub.
* **Filter bar** above the tabs (`filters/filter-bar`): *Owner*, *Repository* and *Label* buttons open Material menus whose options are `menuitemcheckbox`es with a `mat-pseudo-checkbox`, so they work with the keyboard. A button names its state ("Owner: 2 of 3", "Label: bug"), and the bar ends with "Showing 12 of 15 · 3 hidden" and *Clear filters*.
  * **Owner and repository:** unchecking hides them. New owners and repositories show up automatically, and a hidden owner's repositories are disabled.
  * **Label:** picking labels shows only items carrying at least one of them. With none picked, every item shows.
  * The tab counts follow the filters, and a tab whose items are all filtered out says so. Changes are saved per user with `PUT /overview/filters`, one after the other. If saving fails, the filters still apply until the page is reloaded.
* **Refresh** (`refresh-status`, also on the team view): "Updated 5 minutes ago" with a refresh button. A refresh keeps the current lists and the open tab visible under a thin progress bar. If it fails, the lists stay and it says "Couldn't refresh". Coming back to the browser tab after more than 5 minutes refreshes on its own, which also keeps the session alive (sliding session).
* **States:** a skeleton in the shape of tabs and rows while loading (`layout/list-skeleton`), an empty message per tab, "Nothing waiting on you 🎉" when all four are empty, and an error with **Try again** that says whether Hoot's server or GitHub failed.
* **GitHub access card** (`pages/overview/github-access`): if the app is installed nowhere, it replaces the tabs and asks the user to install it, since every list would otherwise be empty. Otherwise it sits below the tabs and lists the accounts Hoot can see (all or selected repositories, with a link to change that on GitHub) and an "Add an account or organization" link to the same install page.

---

Organization Page

```
/orgs/:organization
```

The team view of one organization from `GET /orgs/{organization}/overview`, with the same tabs and rows as the overview (the shared `pages/overview/list-tabs`): *Waiting for review*, *Failing CI*, *Unassigned* and *No update for 60 days*. Each tab shows GitHub's total and links to the full search on GitHub when there are more than the 20 loaded items, and the page opens on the first tab with items. Items say when and by whom they were opened and who is assigned. The sidenav lists every organization where Hoot is installed under *Teams*. Loading, error (with "Hoot isn't installed on …" for a 404) and empty states work like on the overview, through the shared `layout/list-skeleton` and `layout/load-error`.

---

Profile Page

```
/profile
```

Shows the logged-in user's id and GitHub login as a Material list in a card.

---

# Angular Auth Service

File:

```
frontend/src/app/services/auth.ts
```

Responsibilities:

* knowing who is logged in (`user`, `isLoggedIn` signals)
* loading the session once from `GET /profile`
* logout via `POST /logout`

---

# Session Handling

The session token lives only in the HttpOnly cookie `hoot_session`. The frontend never sees it.

* `services/session-interceptor.ts` sends every request to the backend with `withCredentials: true`, so the browser includes the cookie. A `401` during an active session (expired token) clears the session and opens `/login`.
* `services/auth.ts` keeps the logged-in user in a signal. At startup the app asks `GET /profile` once, and the guards reuse that answer.
* Open the frontend as `http://localhost:4200`, not `127.0.0.1`. The cookie belongs to `localhost`, and only the same site gets it.

---

# Styling

The UI uses an Angular Material 3 theme built from the brand orange `#fea034` and its complementary blue `#3492fe`. The design rules are in issue #55.

* `frontend/src/_theme-colors.scss`: generated tonal palettes. Don't edit by hand; regenerate with:

  ```
  cd frontend
  npx ng generate @angular/material:theme-color --primary-color="#fea034" --tertiary-color="#3492fe" --directory=src/ --is-scss=true --include-high-contrast=false
  ```

* `frontend/src/material-theme.scss`: applies the palettes and emits the `--mat-sys-*` tokens (colours, type scale, corners, elevation).
* `frontend/src/styles.css`: Hoot's own tokens: `--hoot-brand` / `--hoot-on-brand` (bright orange fill with dark text, because white text on it fails contrast), the `--hoot-status-*` colours for GitHub states, the `--hoot-space-*` spacing scale, the focus ring and transitions.
* **Dark mode** follows the system setting (`color-scheme: light dark`). Every `--mat-sys-*` colour has a light and a dark value (`light-dark()`), and so do Hoot's own colours where they differ, e.g. `--hoot-status-success: light-dark(#1a7f37, #3fb950)`. The brand orange with its dark text works in both modes.
* Roboto is self-hosted via `@fontsource/roboto`, so the app loads nothing from Google or other CDNs.

---

# Running the Project

First time only: create the GitHub App and `.env` with `python backend/setup_github_app.py` (see *GitHub App*).

Start backend (creates the SQLite database on first start, restarts when backend code changes):

```
python backend/app/main.py
```

This works from any working directory, and so does the IDE's Run button on `main.py`. `python -m backend.app.main` and `uvicorn backend.app.main:app --reload` (both from the repo root) start the same server.

Run the backend tests from the repo root (they use a temporary SQLite database, not `backend/hoot.db`, and a mocked GitHub):

```
pytest
```

Both backend and frontend tests also run in CI on every pull request (`.github/workflows/tests.yml`).

Backend URL:

```
http://localhost:8000
```

API documentation:

```
http://localhost:8000/docs
```

---

Start Angular frontend:

```
cd frontend
npm install
ng serve
```

Requires **Node.js 24 LTS**, at least 24.15 (Angular 22 supports `^22.22.3 || ^24.15.0 || >=26`, but Node 25+ breaks `localStorage` in the unit tests). Run the tests with:

```
npm test
```

Frontend URL:

```
http://localhost:4200
```

---

# Authentication Flow

1. User opens the Angular login page and clicks "Sign in with GitHub"
2. The browser opens `/auth/github/login`, which redirects to GitHub
3. User authorizes Hoot on GitHub
4. GitHub redirects to `/auth/github/callback`
5. FastAPI checks the state, exchanges the code, stores the encrypted GitHub tokens
6. FastAPI sets the HttpOnly session cookie and redirects to the frontend
7. Angular requests `/profile`; the browser sends the cookie
8. Backend returns user data, and the overview page loads
9. Logout calls `POST /logout`, which deletes the cookie

---

# Security Notes

Hoot stores no passwords; signing in is delegated to GitHub.

JWT tokens contain:

* user id
* expiration timestamp

Protected routes require a valid session cookie.

Sessions end after `ACCESS_TOKEN_EXPIRE_MINUTES` without requests, and at the latest `SESSION_MAX_DAYS` after signing in.

The cookie is `HttpOnly` (unreadable for JavaScript, so XSS cannot steal it), `SameSite=Lax` (other sites can't send it along with POST requests) and `Secure` by default.

GitHub tokens are encrypted at rest, never returned by an API response and never logged. See *GitHub Sign-in* for state, PKCE and redirect handling.

---

# Future Improvements

Possible extensions:

* HTTPS support
* deployment with Docker containers

---

# Summary

This project demonstrates a complete authentication system using:

* FastAPI backend
* Angular frontend
* SQLite database
* Sign-in with GitHub (OAuth with state and PKCE)
* JWT session cookies
