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
3. FastAPI returns a JWT access token
4. Angular stores the token
5. Angular sends the token with requests to protected endpoints
6. FastAPI validates the token and returns protected data

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
SECRET_KEY=supersecretkey
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

Explanation:

SECRET_KEY
Used to sign JWT tokens. **Required** — the backend refuses to start without it.

ALGORITHM
JWT encryption algorithm. Default: `HS256`.

ACCESS_TOKEN_EXPIRE_MINUTES
Defines how long a login token remains valid. Default: `60`.

CORS_ORIGINS
Comma-separated list of frontend origins allowed to call the API. Default: `http://localhost:4200,http://127.0.0.1:4200`.

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

1. Extract token from Authorization header
2. Decode JWT
3. Extract user id
4. Query database
5. Return authenticated user

Header format:

```
Authorization: Bearer <token>
```

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
4. Return access token

Response:

```
{
  "access_token": "TOKEN",
  "token_type": "bearer"
}
```

---

Profile (Protected Route)

```
GET /profile
```

Requires a valid JWT.

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

* JWT token saved in localStorage
* User redirected to `/profile`

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

# Token Storage

Token is stored in:

```
localStorage
```

Example:

```
localStorage.setItem("token", token)
```

Used for authenticated requests.

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
5. FastAPI returns JWT token
6. Angular stores token
7. Angular requests `/profile`
8. Token is validated
9. Backend returns user data

---

# Security Notes

Passwords are protected using bcrypt hashing.

JWT tokens contain:

* user id
* expiration timestamp

Protected routes require valid tokens.

Tokens expire automatically.

---

# Future Improvements

Possible extensions:

* refresh tokens
* logout system
* email verification
* password reset
* Angular route guards
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