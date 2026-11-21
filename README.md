# Hoot

One page for everything that is waiting on you on GitHub: assigned issues, your open pull requests, review requests and mentions, across all your repositories and organizations.

Built with **FastAPI**, **SQLite**, **Angular** and **JWT** sessions.

> **Status:** early. The current code is the authentication foundation (email/password login with JWT). Next up is signing in with GitHub and the overview page; see the open issues.

---

# Architecture Overview

This project consists of three main components:

* **Backend**: FastAPI application handling authentication and database access
* **Frontend**: Angular application providing login and profile UI
* **Database**: SQLite file (`backend/hoot.db`) for persistent user storage, created automatically on first start

Authentication is implemented using **JWT (JSON Web Tokens)**.

Flow:

1. User registers or logs in via Angular frontend
2. FastAPI validates credentials
3. FastAPI sets the JWT as an HttpOnly session cookie (`hoot_session`)
4. The browser sends the cookie with every request to the backend
5. FastAPI validates the token and returns protected data

---

# Project Structure

```
Hoot
│
├── backend
│   └── app
│       ├── main.py
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
│       └── services
│           └── auth.ts
│
├── .env
└── README.md
```

---

# Backend (FastAPI)

The backend handles:

* authentication
* password hashing
* JWT token generation
* protected endpoints
* database communication

Main technologies:

* FastAPI
* SQLAlchemy
* SQLite
* bcrypt (password hashing)
* PyJWT (JWT)
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

# Environment Variables (.env)

Example `.env` file:

```
SECRET_KEY=<output of the command below>
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

ALGORITHM
JWT encryption algorithm. Default: `HS256`.

ACCESS_TOKEN_EXPIRE_MINUTES
Defines how long a login token remains valid. Default: `60`.

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

The file and the `users` table are created automatically on first start. Delete the file to start with an empty database.

---

# Database Model

File: `models.py`

Defines the user table.

```
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    hashed_password = Column(String)
```

Table structure:

| Column          | Description          |
| --------------- | -------------------- |
| id              | Primary key          |
| email           | Unique user email    |
| hashed_password | Secure password hash |

Passwords are **never stored in plain text**.

---

# Pydantic Schemas

File: `schemas.py`

Schemas define how data is validated and returned.

UserCreate

Used during registration.

```
email
password
```

UserResponse

Returned to frontend.

```
id
email
```

UserLogin

Defines login structure.

---

# FastAPI Application

File: `main.py`

This file contains:

* application initialization
* middleware
* authentication logic
* API routes

---

# CORS Middleware

```
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ]
)
```

Purpose:

Allows the Angular frontend to communicate with the FastAPI backend.

Without this, browsers block requests.

---

# Password Hashing

Passwords are hashed using **bcrypt** (`hash_password` / `verify_password` in `main.py`).

Hashing:

```
hashed_password = hash_password(user.password)
```

Verification:

```
verify_password(password, hashed_password)
```

bcrypt only accepts up to 72 bytes, so `/register` rejects longer passwords with `422`.

---

# JWT Authentication

JWT tokens are created after successful login.

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

Register

```
POST /register
```

Creates a new user.

Body:

```
{
  "email": "user@example.com",
  "password": "123456"
}
```

Process:

1. Hash password
2. Save user
3. Return created user

If the email is already registered, it returns `409 Conflict` with `{"detail": "Email already registered"}`.

---

Login

```
POST /login
```

Uses OAuth2 form data.

Body:

```
username=email
password=password
```

Process:

1. Verify email
2. Verify password
3. Generate JWT
4. Set it as session cookie

Response: `204 No Content` with

```
Set-Cookie: hoot_session=<jwt>; HttpOnly; Max-Age=3600; Path=/; SameSite=lax; Secure
```

The token is never in the response body, so JavaScript cannot read it.

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
  "email": "user@example.com"
}
```

---

# Frontend (Angular)

The Angular frontend provides:

* Login page
* Profile page
* Auth service for API communication

Framework: Angular (standalone components)

---

# Angular Pages

Login Page

```
/login
```

User enters email and password.

Angular sends login request to backend.

On success:

* the backend sets the session cookie
* the frontend loads the user from `/profile` and redirects to `/`

---

Profile Page

```
/profile
```

Angular sends request with JWT token.

Backend validates token and returns user data.

---

# Angular Auth Service

File:

```
frontend/src/app/services/auth.ts
```

Responsibilities:

* login requests
* saving JWT tokens
* sending authenticated requests

Example login request:

```
POST /login
```

Body:

```
username=email
password=password
```

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

Start backend (creates the SQLite database on first start):

```
uvicorn backend.app.main:app --reload
```

Run the backend tests from the repo root (they use a temporary SQLite database, not `backend/hoot.db`):

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

1. User opens Angular login page
2. User submits credentials
3. Angular sends request to `/login`
4. FastAPI validates credentials
5. FastAPI sets the HttpOnly session cookie
6. Angular requests `/profile`; the browser sends the cookie
7. Token is validated
8. Backend returns user data
9. Logout calls `POST /logout`, which deletes the cookie

---

# Security Notes

Passwords are protected using bcrypt hashing.

JWT tokens contain:

* user id
* expiration timestamp

Protected routes require a valid session cookie.

Tokens expire automatically.

The cookie is `HttpOnly` (unreadable for JavaScript, so XSS cannot steal it), `SameSite=Lax` (other sites can't send it along with POST requests) and `Secure` by default.

---

# Future Improvements

Possible extensions:

* refresh tokens
* email verification
* password reset
* HTTPS support
* deployment with Docker containers

---

# Summary

This project demonstrates a complete authentication system using:

* FastAPI backend
* Angular frontend
* SQLite database
* JWT authentication

It provides a simple but production-like example of how modern web authentication systems work.