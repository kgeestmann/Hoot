# Mini Auth Project

A minimal full-stack authentication system built with **FastAPI**, **PostgreSQL**, **Angular**, **JWT authentication**, and **Docker**.
The project demonstrates a modern authentication flow including user registration, login, token generation, and protected routes.

---

# Architecture Overview

This project consists of three main components:

* **Backend**: FastAPI application handling authentication and database access
* **Frontend**: Angular application providing login and profile UI
* **Database**: PostgreSQL for persistent user storage

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
mini-auth-project
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
├── docker
│   └── docker-compose.yml
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
* PostgreSQL
* Passlib (password hashing)
* python-jose (JWT)
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
```

Explanation:

SECRET_KEY
Used to sign JWT tokens.

ALGORITHM
JWT encryption algorithm.

ACCESS_TOKEN_EXPIRE_MINUTES
Defines how long a login token remains valid.

---

# Database Configuration

File: `database.py`

Responsible for:

* database connection
* session creation
* SQLAlchemy base model

Key components:

create_engine
Creates connection to PostgreSQL.

SessionLocal
Creates a database session for each request.

Base
Base class for database models.

Connection string:

```
postgresql://admin:admin@localhost:5432/mini_auth
```

Format:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

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

Passwords are hashed using **bcrypt**.

```
pwd_context = CryptContext(schemes=["bcrypt"])
```

Hashing:

```
hashed_password = pwd_context.hash(user.password)
```

Verification:

```
pwd_context.verify(password, hashed_password)
```

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

# Docker

Docker allows running the database in a container.

File:

```
docker/docker-compose.yml
```

Example structure:

```
services:
  postgres:
    image: postgres
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin
      POSTGRES_DB: mini_auth
    ports:
      - "5432:5432"
```

Start container:

```
docker compose up -d
```

---

# Running the Project

Start database:

```
docker compose up -d
```

Start backend:

```
uvicorn backend.app.main:app --reload
```

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
* PostgreSQL database
* JWT authentication
* Docker containerized database

It provides a simple but production-like example of how modern web authentication systems work.