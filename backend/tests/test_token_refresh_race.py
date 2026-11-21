"""Parallel requests of one user must not spend the single-use refresh token twice (#91)."""

import threading
import time

import httpx
import pytest

from backend.app import github, github_tokens, models
from backend.app.crypto import decrypt_token, encrypt_token
from backend.app.database import SessionLocal

PARALLEL_REQUESTS = 3


class RotatingGitHub:
    """GitHub with single-use refresh tokens; a refresh takes a moment, so parallel ones overlap."""

    def __init__(self):
        self.valid_access_token = "gho_old"
        self.valid_refresh_token = "ghr_old"
        self.refreshes = 0
        self._lock = threading.Lock()

    def handle(self, request: httpx.Request) -> httpx.Response:
        form = dict(httpx.QueryParams(request.content.decode()))
        time.sleep(0.2)
        with self._lock:
            if form.get("refresh_token") != self.valid_refresh_token:
                return httpx.Response(200, json={"error": "bad_refresh_token"})
            self.refreshes += 1
            self.valid_access_token = f"gho_new-{self.refreshes}"
            self.valid_refresh_token = f"ghr_new-{self.refreshes}"
            return httpx.Response(
                200,
                json={
                    "access_token": self.valid_access_token,
                    "expires_in": 28800,
                    "refresh_token": self.valid_refresh_token,
                    "refresh_token_expires_in": 15811200,
                },
            )

    def api_call(self, access_token: str) -> str:
        """Stands in for a GitHub API call: only the current access token is accepted."""
        if access_token != self.valid_access_token:
            raise github.GitHubTokenRejected("401")
        return access_token


@pytest.fixture
def github_fake(client):
    """A fresh database (via `client`) and the rotating GitHub."""
    return RotatingGitHub()


def store_user(access_token_expires_at: int) -> int:
    with SessionLocal() as db:
        user = models.User(
            github_id=4242,
            login="octocat",
            github_access_token=encrypt_token("gho_old"),
            github_access_token_expires_at=access_token_expires_at,
            github_refresh_token=encrypt_token("ghr_old"),
            github_refresh_token_expires_at=int(time.time()) + 3600,
        )
        db.add(user)
        db.commit()
        return user.id


def run_parallel_requests(user_id: int, github_fake: RotatingGitHub):
    """Call GitHub as the user from several threads at once, each with its own DB session."""
    results, errors = [], []

    def one_request():
        transport = httpx.MockTransport(github_fake.handle)
        with SessionLocal() as db, httpx.Client(transport=transport) as client:
            user = db.get(models.User, user_id)
            try:
                results.append(github_tokens.call_as_user(db, client, user, github_fake.api_call))
            except Exception as error:
                errors.append(error)

    threads = [threading.Thread(target=one_request) for _ in range(PARALLEL_REQUESTS)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results, errors


def stored_access_token(user_id: int) -> str | None:
    with SessionLocal() as db:
        token = db.get(models.User, user_id).github_access_token
        return decrypt_token(token) if token else None


def test_expired_token_is_refreshed_once_for_parallel_requests(github_fake):
    user_id = store_user(access_token_expires_at=int(time.time()) - 60)

    results, errors = run_parallel_requests(user_id, github_fake)

    assert errors == []
    assert github_fake.refreshes == 1
    assert results == ["gho_new-1"] * PARALLEL_REQUESTS
    assert stored_access_token(user_id) == "gho_new-1"


def test_token_rejected_by_github_is_refreshed_once_for_parallel_requests(github_fake):
    user_id = store_user(access_token_expires_at=int(time.time()) + 3600)
    github_fake.valid_access_token = "gho_revoked-early"

    results, errors = run_parallel_requests(user_id, github_fake)

    assert errors == []
    assert github_fake.refreshes == 1
    assert results == ["gho_new-1"] * PARALLEL_REQUESTS
    assert stored_access_token(user_id) == "gho_new-1"


def test_revoked_app_still_signs_out_every_parallel_request(github_fake):
    user_id = store_user(access_token_expires_at=int(time.time()) - 60)
    github_fake.valid_refresh_token = "ghr_revoked"

    results, errors = run_parallel_requests(user_id, github_fake)

    assert results == []
    assert len(errors) == PARALLEL_REQUESTS
    assert all(isinstance(error, github_tokens.SignInRequired) for error in errors)
    assert stored_access_token(user_id) is None
