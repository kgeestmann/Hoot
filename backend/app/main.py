import logging
import secrets
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Started as a script (python backend/app/main.py): load this file as part of the
# backend.app package, so that the relative imports below resolve (PEP 366).
if not __package__:
    sys.path.insert(0, str(REPO_ROOT))
    __package__ = "backend.app"

import httpx
import jwt
import uvicorn
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import APIKeyCookie
from sqlalchemy.orm import Session

from . import github, models, schemas
from .config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    COOKIE_SECURE,
    CORS_ORIGINS,
    FRONTEND_URL,
    SECRET_KEY,
)
from .crypto import encrypt_token
from .database import engine, SessionLocal

logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_COOKIE_NAME = "hoot_session"

# auto_error=False so that a missing cookie gets the same 401 as an invalid one.
session_cookie = APIKeyCookie(name=SESSION_COOKIE_NAME, auto_error=False)

# Holds state and PKCE verifier between /auth/github/login and the callback.
OAUTH_COOKIE_NAME = "hoot_oauth"
OAUTH_COOKIE_PATH = "/auth/github"
OAUTH_COOKIE_MINUTES = 10
# An audience keeps OAuth cookies and session tokens from being accepted in place of each other.
OAUTH_AUDIENCE = "hoot:github-oauth"

SIGN_IN_FAILED_URL = f"{FRONTEND_URL}/login?error=github"


def set_session_cookie(response: Response, token: str) -> None:
    """Store the session JWT in a cookie that JavaScript cannot read."""
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    """Tell the browser to delete the session cookie."""
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_github_client():
    """HTTP client for calls to GitHub; tests replace it with a mock transport."""
    with httpx.Client(timeout=10) as client:
        yield client


def create_access_token(data: dict):
    """Sign the given claims as a JWT that expires after ACCESS_TOKEN_EXPIRE_MINUTES."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str | None = Depends(session_cookie),
    db: Session = Depends(get_db)
):
    """Return the user the session cookie belongs to, or raise 401."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    if token is None:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if user is None:
        raise credentials_exception

    return user


def create_oauth_cookie(state: str, verifier: str) -> str:
    """Sign state and PKCE verifier so the callback can trust them for a few minutes."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=OAUTH_COOKIE_MINUTES)
    claims = {"state": state, "verifier": verifier, "aud": OAUTH_AUDIENCE, "exp": expire}
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)


def verified_code_verifier(oauth_cookie: str | None, state: str | None) -> str:
    """Return the PKCE verifier if the callback's state matches the signed cookie, else raise 400."""
    invalid_state = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired sign-in attempt. Please start again.",
    )
    if oauth_cookie is None or state is None:
        raise invalid_state
    try:
        claims = jwt.decode(
            oauth_cookie,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=OAUTH_AUDIENCE,
            options={"require": ["exp", "aud", "state", "verifier"]},
        )
    except jwt.PyJWTError:
        raise invalid_state
    if not secrets.compare_digest(str(claims["state"]), state):
        raise invalid_state
    return str(claims["verifier"])


def expires_at(seconds_from_now: int | None) -> int | None:
    """Turn GitHub's "expires in" seconds into a Unix timestamp."""
    return None if seconds_from_now is None else int(time.time()) + seconds_from_now


def save_github_user(
    db: Session, github_user: github.GitHubUser, tokens: github.GitHubTokens
) -> models.User:
    """Create or update the user for a GitHub account and store its tokens encrypted."""
    user = db.query(models.User).filter(models.User.github_id == github_user.id).first()
    if user is None:
        user = models.User(github_id=github_user.id)
        db.add(user)

    user.login = github_user.login
    user.github_access_token = encrypt_token(tokens.access_token)
    user.github_access_token_expires_at = expires_at(tokens.access_token_expires_in)
    user.github_refresh_token = (
        encrypt_token(tokens.refresh_token) if tokens.refresh_token else None
    )
    user.github_refresh_token_expires_at = expires_at(tokens.refresh_token_expires_in)

    db.commit()
    db.refresh(user)
    return user


def redirect_after_sign_in(url: str) -> RedirectResponse:
    """Redirect to a fixed frontend URL and drop the one-time OAuth cookie."""
    response = RedirectResponse(url, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(
        key=OAUTH_COOKIE_NAME,
        path=OAUTH_COOKIE_PATH,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    return response


@app.get("/")
def read_root():
    return {"message": "Backend läuft!"}


@app.get("/auth/github/login")
def github_login():
    """Send the browser to GitHub to authorize Hoot (OAuth with state and PKCE)."""
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)

    response = RedirectResponse(
        github.authorize_url(state, verifier), status_code=status.HTTP_302_FOUND
    )
    response.set_cookie(
        key=OAUTH_COOKIE_NAME,
        value=create_oauth_cookie(state, verifier),
        max_age=OAUTH_COOKIE_MINUTES * 60,
        path=OAUTH_COOKIE_PATH,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    return response


@app.get("/auth/github/callback")
def github_callback(
    state: str | None = None,
    code: str | None = None,
    oauth_cookie: str | None = Cookie(default=None, alias=OAUTH_COOKIE_NAME),
    db: Session = Depends(get_db),
    github_client: httpx.Client = Depends(get_github_client),
):
    """Finish the GitHub sign-in: check state, exchange the code, start a Hoot session."""
    verifier = verified_code_verifier(oauth_cookie, state)

    # Without a code the user cancelled on GitHub (GitHub then sends ?error=access_denied).
    if code is None:
        return redirect_after_sign_in(SIGN_IN_FAILED_URL)

    try:
        tokens = github.exchange_code(github_client, code, verifier)
        github_user = github.fetch_user(github_client, tokens.access_token)
    except github.GitHubError as error:
        logger.warning("GitHub sign-in failed: %s", error)
        return redirect_after_sign_in(SIGN_IN_FAILED_URL)

    user = save_github_user(db, github_user, tokens)

    response = redirect_after_sign_in(f"{FRONTEND_URL}/")
    set_session_cookie(response, create_access_token(data={"sub": str(user.id)}))
    return response


@app.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    """End the session by deleting the session cookie."""
    clear_session_cookie(response)


@app.get("/profile", response_model=schemas.UserResponse)
def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


def run_dev_server() -> None:
    """Start the API on http://localhost:8000 and restart it when backend code changes."""
    uvicorn.run(
        "backend.app.main:app",
        reload=True,
        reload_dirs=[str(REPO_ROOT / "backend")],
        app_dir=str(REPO_ROOT),
    )


if __name__ == "__main__":
    run_dev_server()
