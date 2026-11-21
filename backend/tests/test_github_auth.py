import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest

from backend.app import github, main, models
from backend.app.config import ALGORITHM, GITHUB_CALLBACK_URL, SECRET_KEY
from backend.app.crypto import decrypt_token
from backend.app.database import SessionLocal
from backend.app.main import (
    OAUTH_AUDIENCE,
    OAUTH_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    SIGN_IN_FAILED_URL,
    app,
    create_access_token,
    get_github_client,
)

ACCESS_TOKEN = "gho_access-token"
REFRESH_TOKEN = "ghr_refresh-token"


class FakeGitHub:
    """Stands in for GitHub's token and user endpoints and records every request."""

    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.token_response = httpx.Response(
            200,
            json={
                "access_token": ACCESS_TOKEN,
                "expires_in": 28800,
                "refresh_token": REFRESH_TOKEN,
                "refresh_token_expires_in": 15811200,
                "token_type": "bearer",
                "scope": "",
            },
        )
        self.user_response = httpx.Response(200, json={"id": 4242, "login": "octocat"})
        self.unreachable = False

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.unreachable:
            raise httpx.ConnectError("connection refused", request=request)
        if str(request.url) == github.TOKEN_URL:
            return self.token_response
        if str(request.url) == github.USER_URL:
            return self.user_response
        return httpx.Response(404)


@pytest.fixture
def fake_github(client):
    fake = FakeGitHub()

    def mocked_client():
        with httpx.Client(transport=httpx.MockTransport(fake.handle)) as mocked:
            yield mocked

    app.dependency_overrides[get_github_client] = mocked_client
    yield fake
    app.dependency_overrides.pop(get_github_client, None)


def start_sign_in(client):
    """Call /auth/github/login and return the response and GitHub authorize query."""
    response = client.get("/auth/github/login", follow_redirects=False)
    query = {key: values[0] for key, values in parse_qs(urlsplit(response.headers["location"]).query).items()}
    return response, query


def finish_sign_in(client, state, code="the-code", **extra_params):
    """Call the callback the way GitHub redirects the browser back."""
    params = {"state": state, "code": code, **extra_params}
    return client.get("/auth/github/callback", params=params, follow_redirects=False)


def sign_in(client):
    """Run the whole sign-in and return the callback response."""
    _, query = start_sign_in(client)
    return finish_sign_in(client, query["state"])


def cookie_header(response, name):
    """Return the Set-Cookie header for the named cookie."""
    headers = [h for h in response.headers.get_list("set-cookie") if h.startswith(f"{name}=")]
    assert len(headers) == 1, headers
    return headers[0]


def oauth_cookie_claims(client):
    """Decode the signed OAuth cookie the browser holds after /auth/github/login."""
    return jwt.decode(client.cookies[OAUTH_COOKIE_NAME], SECRET_KEY, algorithms=[ALGORITHM], audience=OAUTH_AUDIENCE)


def stored_users():
    with SessionLocal() as db:
        return db.query(models.User).all()


# --- /auth/github/login ---


def test_login_redirects_to_github_with_state_and_pkce(client):
    response, query = start_sign_in(client)

    assert response.status_code == 302
    assert response.headers["location"].startswith(f"{github.AUTHORIZE_URL}?")
    assert query["client_id"] == "test-client-id"
    assert query["redirect_uri"] == GITHUB_CALLBACK_URL
    assert query["code_challenge_method"] == "S256"
    assert len(query["state"]) >= 43
    claims = oauth_cookie_claims(client)
    assert claims["state"] == query["state"]
    assert query["code_challenge"] == github.code_challenge(claims["verifier"])


def test_login_sets_a_short_lived_httponly_oauth_cookie(client):
    response, _ = start_sign_in(client)

    cookie = cookie_header(response, OAUTH_COOKIE_NAME).lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/auth/github" in cookie
    assert "max-age=600" in cookie


def test_each_login_uses_a_new_state(client):
    _, first = start_sign_in(client)
    _, second = start_sign_in(client)

    assert first["state"] != second["state"]


# --- successful callback ---


def test_callback_signs_in_and_redirects_to_the_frontend(client, fake_github):
    response = sign_in(client)

    assert response.status_code == 302
    assert response.headers["location"] == "http://frontend.test/"
    assert client.get("/profile").json() == {"id": 1, "login": "octocat"}


def test_callback_sets_an_httponly_session_cookie(client, fake_github):
    cookie = cookie_header(sign_in(client), SESSION_COOKIE_NAME).lower()

    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie


def test_session_cookie_is_secure_when_configured(client, fake_github, monkeypatch):
    _, query = start_sign_in(client)
    # Only now: the plain-http test client would not send a Secure OAuth cookie back.
    monkeypatch.setattr(main, "COOKIE_SECURE", True)

    response = finish_sign_in(client, query["state"])

    assert "secure" in cookie_header(response, SESSION_COOKIE_NAME).lower()


def test_logout_ends_the_session(client, fake_github):
    sign_in(client)

    response = client.post("/logout")

    assert response.status_code == 204
    assert "max-age=0" in cookie_header(response, SESSION_COOKIE_NAME).lower()
    assert client.get("/profile").status_code == 401


def test_callback_exchanges_the_code_with_secret_and_pkce_verifier(client, fake_github):
    _, query = start_sign_in(client)
    verifier = oauth_cookie_claims(client)["verifier"]

    finish_sign_in(client, query["state"], code="the-code")

    token_request, user_request = fake_github.requests
    form = {key: values[0] for key, values in parse_qs(token_request.content.decode()).items()}
    assert form == {
        "client_id": "test-client-id",
        "client_secret": "test-client-secret",
        "code": "the-code",
        "redirect_uri": GITHUB_CALLBACK_URL,
        "code_verifier": verifier,
    }
    assert token_request.headers["accept"] == "application/json"
    assert user_request.headers["authorization"] == f"Bearer {ACCESS_TOKEN}"


def test_callback_drops_the_oauth_cookie(client, fake_github):
    assert "max-age=0" in cookie_header(sign_in(client), OAUTH_COOKIE_NAME).lower()


def test_github_tokens_are_stored_encrypted(client, fake_github):
    sign_in(client)

    [user] = stored_users()
    assert user.github_access_token != ACCESS_TOKEN
    assert decrypt_token(user.github_access_token) == ACCESS_TOKEN
    assert user.github_refresh_token != REFRESH_TOKEN
    assert decrypt_token(user.github_refresh_token) == REFRESH_TOKEN
    assert abs(user.github_access_token_expires_at - (time.time() + 28800)) < 10
    assert abs(user.github_refresh_token_expires_at - (time.time() + 15811200)) < 10


def test_tokens_without_expiry_are_stored_without_expiry(client, fake_github):
    fake_github.token_response = httpx.Response(200, json={"access_token": ACCESS_TOKEN, "token_type": "bearer"})

    sign_in(client)

    [user] = stored_users()
    assert user.github_access_token_expires_at is None
    assert user.github_refresh_token is None


def test_github_tokens_never_leave_the_backend(client, fake_github):
    login_response, query = start_sign_in(client)
    callback_response = finish_sign_in(client, query["state"])
    profile_response = client.get("/profile")

    for response in (login_response, callback_response, profile_response):
        exposed = response.text + str(response.headers)
        assert ACCESS_TOKEN not in exposed
        assert REFRESH_TOKEN not in exposed


def test_signing_in_again_updates_the_same_user(client, fake_github):
    sign_in(client)
    fake_github.user_response = httpx.Response(200, json={"id": 4242, "login": "octocat-renamed"})

    sign_in(client)

    [user] = stored_users()
    assert user.id == 1
    assert user.login == "octocat-renamed"


def test_users_are_matched_by_github_id_not_login(client, fake_github):
    sign_in(client)
    fake_github.user_response = httpx.Response(200, json={"id": 9999, "login": "octocat"})

    sign_in(client)

    assert [(u.github_id, u.login) for u in stored_users()] == [(4242, "octocat"), (9999, "octocat")]


def test_callback_ignores_redirect_parameters(client, fake_github):
    _, query = start_sign_in(client)

    response = finish_sign_in(client, query["state"], next="https://evil.test", redirect_uri="https://evil.test")

    assert response.headers["location"] == "http://frontend.test/"


# --- rejected state ---


def test_callback_without_oauth_cookie_is_rejected(client, fake_github):
    _, query = start_sign_in(client)
    client.cookies.clear()

    response = finish_sign_in(client, query["state"])

    assert response.status_code == 400
    assert SESSION_COOKIE_NAME not in response.cookies
    assert fake_github.requests == []


def test_callback_with_wrong_state_is_rejected(client, fake_github):
    start_sign_in(client)

    response = finish_sign_in(client, "state-from-an-attacker")

    assert response.status_code == 400
    assert SESSION_COOKIE_NAME not in response.cookies
    assert fake_github.requests == []


def test_callback_without_state_is_rejected(client, fake_github):
    start_sign_in(client)

    response = client.get("/auth/github/callback", params={"code": "the-code"}, follow_redirects=False)

    assert response.status_code == 400


def test_expired_oauth_cookie_is_rejected(client, fake_github):
    expired = jwt.encode(
        {
            "state": "s",
            "verifier": "v",
            "aud": OAUTH_AUDIENCE,
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    client.cookies.set(OAUTH_COOKIE_NAME, expired, path="/auth/github")

    assert finish_sign_in(client, "s").status_code == 400


def test_session_token_is_not_accepted_as_oauth_cookie(client, fake_github):
    client.cookies.set(OAUTH_COOKIE_NAME, create_access_token(data={"sub": "1"}), path="/auth/github")

    assert finish_sign_in(client, "s").status_code == 400


def test_state_cannot_be_replayed(client, fake_github):
    _, query = start_sign_in(client)
    finish_sign_in(client, query["state"])
    client.cookies.delete(SESSION_COOKIE_NAME)

    response = finish_sign_in(client, query["state"])

    assert response.status_code == 400
    assert SESSION_COOKIE_NAME not in response.cookies


# --- GitHub-side failures ---


def assert_sign_in_failed(response):
    assert response.status_code == 302
    assert response.headers["location"] == SIGN_IN_FAILED_URL
    assert SESSION_COOKIE_NAME not in response.cookies
    assert stored_users() == []


def test_cancelling_on_github_redirects_to_the_login_page(client, fake_github):
    _, query = start_sign_in(client)

    response = client.get(
        "/auth/github/callback",
        params={"state": query["state"], "error": "access_denied"},
        follow_redirects=False,
    )

    assert_sign_in_failed(response)
    assert fake_github.requests == []


def test_rejected_code_redirects_to_the_login_page(client, fake_github):
    fake_github.token_response = httpx.Response(200, json={"error": "bad_verification_code"})

    assert_sign_in_failed(sign_in(client))


def test_failing_user_request_redirects_to_the_login_page(client, fake_github):
    fake_github.user_response = httpx.Response(401, json={"message": "Bad credentials"})

    assert_sign_in_failed(sign_in(client))


def test_unreachable_github_redirects_to_the_login_page(client, fake_github):
    fake_github.unreachable = True

    assert_sign_in_failed(sign_in(client))
