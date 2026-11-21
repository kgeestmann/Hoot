import threading
import time
from collections.abc import Callable
from typing import TypeVar

import httpx
from sqlalchemy.orm import Session

from . import github, models
from .crypto import decrypt_token, encrypt_token

Result = TypeVar("Result")

# Refresh a little early, so a token doesn't expire between the check and GitHub's answer.
EXPIRY_MARGIN_SECONDS = 60

# GitHub refresh tokens work only once, so parallel requests of one user must not refresh at the
# same time (#91). The locks only cover one process, which is how Hoot runs (one uvicorn, SQLite).
_refresh_locks: dict[int, threading.Lock] = {}
_refresh_locks_guard = threading.Lock()


class SignInRequired(Exception):
    """The user's GitHub tokens are gone or can't be renewed; they have to sign in again."""


def store_tokens(user: models.User, tokens: github.GitHubTokens) -> None:
    """Put a new pair of GitHub tokens on the user, encrypted, with their expiry times."""
    user.github_access_token = encrypt_token(tokens.access_token)
    user.github_access_token_expires_at = _expires_at(tokens.access_token_expires_in)
    user.github_refresh_token = (
        encrypt_token(tokens.refresh_token) if tokens.refresh_token else None
    )
    user.github_refresh_token_expires_at = _expires_at(tokens.refresh_token_expires_in)


def call_as_user(
    db: Session,
    client: httpx.Client,
    user: models.User,
    request: Callable[[str], Result],
) -> Result:
    """Run request with the user's GitHub access token, renewing the token when it has expired.

    The token is renewed before the call if it is known to be expired, and once more if
    GitHub still rejects it. Raises SignInRequired when the tokens can't be renewed.
    """
    if user.github_access_token is None:
        raise SignInRequired
    if _has_expired(user.github_access_token_expires_at):
        _refresh(db, client, user, stale_token=user.github_access_token)
    try:
        return request(decrypt_token(user.github_access_token))
    except github.GitHubTokenRejected:
        _refresh(db, client, user, stale_token=user.github_access_token)
    rejected_token = user.github_access_token
    try:
        return request(decrypt_token(rejected_token))
    except github.GitHubTokenRejected as error:
        _forget_tokens_unless_replaced(db, user, rejected_token)
        raise SignInRequired from error


def _refresh(db: Session, client: httpx.Client, user: models.User, stale_token: str) -> None:
    """Give the user an access token newer than `stale_token` (as stored, encrypted).

    If another request refreshed while this one waited for the lock, its token is used.
    Otherwise the refresh token is spent; if GitHub rejects it, the tokens are forgotten and
    SignInRequired is raised.
    """
    with _lock_for(user.id):
        db.refresh(user)
        if user.github_access_token is None:
            raise SignInRequired
        if user.github_access_token != stale_token and not _has_expired(
            user.github_access_token_expires_at
        ):
            return
        if user.github_refresh_token is None or _has_expired(user.github_refresh_token_expires_at):
            _forget_tokens(db, user)
            raise SignInRequired
        try:
            tokens = github.refresh_tokens(client, decrypt_token(user.github_refresh_token))
        except github.GitHubTokenRejected as error:
            _forget_tokens(db, user)
            raise SignInRequired from error
        store_tokens(user, tokens)
        db.commit()


def _forget_tokens_unless_replaced(db: Session, user: models.User, rejected_token: str) -> None:
    """Forget the tokens after GitHub rejected a fresh one, unless another request replaced it."""
    with _lock_for(user.id):
        db.refresh(user)
        if user.github_access_token == rejected_token:
            _forget_tokens(db, user)


def _lock_for(user_id: int) -> threading.Lock:
    """The lock that serializes token refreshes of one user."""
    with _refresh_locks_guard:
        return _refresh_locks.setdefault(user_id, threading.Lock())


def _forget_tokens(db: Session, user: models.User) -> None:
    """Delete the user's GitHub tokens, e.g. after the user revoked Hoot on GitHub."""
    user.github_access_token = None
    user.github_access_token_expires_at = None
    user.github_refresh_token = None
    user.github_refresh_token_expires_at = None
    db.commit()


def _expires_at(seconds_from_now: int | None) -> int | None:
    """Turn GitHub's "expires in" seconds into a Unix timestamp."""
    return None if seconds_from_now is None else int(time.time()) + seconds_from_now


def _has_expired(expires_at: int | None) -> bool:
    """Tell whether a token with this expiry time is expired or about to expire."""
    return expires_at is not None and expires_at <= time.time() + EXPIRY_MARGIN_SECONDS
