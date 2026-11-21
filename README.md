# Hoot

One page for everything that is waiting on you on GitHub: assigned issues, your open pull requests, review requests and mentions, across all your repositories and organizations.

Built with **FastAPI**, **SQLite**, **Angular** and **JWT** sessions.

> **Status:** early. Signing in with GitHub and the overview API (`GET /overview`) work; the overview page is next (see the open issues).

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
│   └── app
│       ├── main.py        routes, sessions, GitHub sign-in flow
│       ├── github.py      calls to GitHub (authorize URL, tokens, user, GraphQL)
│       ├── github_tokens.py  storing and refreshing the users' GitHub tokens
│       ├── overview.py    GraphQL searches behind GET /overview
│       ├── crypto.py      encryption of the stored GitHub tokens
│       ├── config.py      settings from .env
│       ├── models.py
│       ├── schemas.py
│       └── database.py
│
├── frontend
│   └── src/app
│       ├── pages
│       │   ├── login
│       │   └── profile
│       │
│       ├── services
│       │   ├── auth.ts
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

Install dependencies:

```
pip install -r backend/requirements.txt
```

---

# GitHub App

Hoot signs users in through a GitHub App. For local development, register your own:

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**
2. **GitHub App name:** must be unique on GitHub, e.g. `Hoot dev <your-username>`
3. **Homepage URL:** `http://localhost:4200`
4. Under *Identifying and authorizing users*:
   * **Redirect URI:** `http://localhost:8000/auth/github/callback`
   * **Allow wildcard matching:** off
   * **Expire user authorization tokens:** on
   * **Request user authorization (OAuth) during installation:** **off**. With it on, GitHub sends the browser to the callback right after installing, without Hoot's `state`, and the callback rejects that (`400`). Signing in always starts from Hoot's "Sign in with GitHub" button.
   * **Enable Device Flow:** off
5. *Post installation*: leave **Setup URL** empty
6. **Webhook:** uncheck *Active*
7. **Repository permissions:** Issues, Pull requests, Checks and Commit statuses → *Read-only* (Metadata is set automatically); everything else stays *No access*. Checks and Commit statuses are needed for the CI status of your pull requests on the overview. After adding permissions to an existing app, accept them on the installation (GitHub → Settings → Applications → Installed GitHub Apps)
8. **Where can this GitHub App be installed?** *Only on this account* for development; *Any account* if it should also be installed on organizations
9. Create the app, then **Generate a new client secret** (GitHub shows it only once)
10. Put the **Client ID** and the client secret into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
11. In the app's settings, **Install App** on your account. Hoot only sees repositories where the app is installed.

---

# Environment Variables (.env)

Example `.env` file:

```
SECRET_KEY=<output of the SECRET_KEY command below>
TOKEN_ENCRYPTION_KEY=<output of the TOKEN_ENCRYPTION_KEY command below>
GITHUB_CLIENT_ID=<Client ID of your GitHub App>
GITHUB_CLIENT_SECRET=<client secret of your GitHub App>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
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

GITHUB_CALLBACK_URL
Must match the callback URL of the GitHub App. Default: `http://localhost:8000/auth/github/callback`.

FRONTEND_URL
Where the browser lands after signing in. Default: `http://localhost:4200`.

ALGORITHM
JWT encryption algorithm. Default: `HS256`.

ACCESS_TOKEN_EXPIRE_MINUTES
Defines how long a Hoot session remains valid. Default: `60`.

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
```

Items in `pull_requests` also carry `ci_status` (GitHub's `SUCCESS`, `FAILURE`, `PENDING`, `ERROR`, `EXPECTED`, or `null` without checks) and `review_decision` (`APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, or `null`).

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

---

# JWT Authentication

JWT tokens are created after a successful sign-in.

Function:

```
create_access_token()
```

Steps:

1. Copy user data
2. Add expiration timestamp
3. Encode using SECRET_KEY
4. Return signed token

Example token payload:

```
{
  "sub": "1",
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
2. Decode JWT (requires `exp` and `sub`)
3. Extract user id
4. Query database
5. Return authenticated user

A missing, invalid or expired cookie returns `401`. An `Authorization` header is not accepted.

---

# API Routes

Root

```
GET /
```

Returns a simple status message.

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

Requires a valid session cookie. Runs four GitHub searches as the user in one GraphQL query, each limited to the 50 most recently updated results, and only covering repositories where the GitHub App is installed:

| List              | GitHub search                                     |
| ----------------- | ------------------------------------------------- |
| `assigned_issues` | `is:open is:issue assignee:@me archived:false`    |
| `pull_requests`   | `is:open is:pr author:@me archived:false`         |
| `review_requests` | `is:open is:pr review-requested:@me archived:false` |
| `mentions`        | `is:open mentions:@me archived:false`             |

Mentions whose latest comment comes from a bot (or, without comments, that a bot opened) are left out. The response shape is described under *Pydantic Schemas*.

Returns `401` (and clears the session cookie) when the GitHub tokens can't be renewed, and `502` when GitHub fails; see *GitHub Sign-in*.

---

# Frontend (Angular)

The Angular frontend provides:

* Sign-in page
* Profile page
* Auth service for API communication

Framework: Angular (standalone components)

---

# Angular Pages

Login Page

```
/login
```

Shows a "Sign in with GitHub" button. It is a plain link to `/auth/github/login` on the backend, because the sign-in is a full page navigation to GitHub and back. With `?error=github` the page explains that the sign-in failed or was cancelled.

---

Profile Page

```
/profile
```

Shows the logged-in user's id and GitHub login.

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
* `frontend/src/styles.css`: Hoot's own tokens: `--hoot-brand` / `--hoot-on-brand` (bright orange fill with dark text, because white text on it fails contrast), the `--hoot-space-*` spacing scale, the focus ring and transitions.
* Roboto is self-hosted via `@fontsource/roboto`, so the app loads nothing from Google or other CDNs.

---

# Running the Project

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
8. Backend returns user data
9. Logout calls `POST /logout`, which deletes the cookie

---

# Security Notes

Hoot stores no passwords; signing in is delegated to GitHub.

JWT tokens contain:

* user id
* expiration timestamp

Protected routes require a valid session cookie.

Tokens expire automatically.

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
