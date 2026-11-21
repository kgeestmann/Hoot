import base64
import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from backend.app.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from backend.app.main import SESSION_COOKIE_NAME, create_access_token, create_oauth_cookie


def signed_token(claims, key=SECRET_KEY):
    """Sign the given claims the way the backend does."""
    return jwt.encode(claims, key, algorithm=ALGORITHM)


def unsigned_token(claims):
    """Build a token with `alg: none` and an empty signature."""
    def encode(part):
        return base64.urlsafe_b64encode(json.dumps(part).encode()).rstrip(b"=").decode()

    return f"{encode({'alg': 'none', 'typ': 'JWT'})}.{encode(claims)}."


def in_minutes(minutes):
    """Return a UTC timestamp the given number of minutes from now."""
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def get_profile(client, token):
    """Request /profile with the given token as session cookie and return the response."""
    client.cookies.set(SESSION_COOKIE_NAME, token)
    return client.get("/profile")


def session_cookie_header(response):
    """Return the Set-Cookie header for the session cookie."""
    headers = [h for h in response.headers.get_list("set-cookie") if h.startswith(f"{SESSION_COOKIE_NAME}=")]
    assert len(headers) == 1
    return headers[0]


def test_session_token_expires_after_the_configured_minutes_in_utc():
    token = create_access_token(data={"sub": "1"})

    expires_at = datetime.fromtimestamp(jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])["exp"], timezone.utc)

    assert abs(expires_at - in_minutes(ACCESS_TOKEN_EXPIRE_MINUTES)) < timedelta(seconds=10)


def test_profile_returns_the_logged_in_user(client, user):
    response = get_profile(client, create_access_token(data={"sub": str(user["id"])}))

    assert response.status_code == 200
    assert response.json() == {"id": user["id"], "login": "octocat"}


def test_profile_without_token_is_unauthorized(client):
    assert client.get("/profile").status_code == 401


def test_profile_with_invalid_token_is_unauthorized(client):
    assert get_profile(client, "not-a-jwt").status_code == 401


def test_profile_ignores_a_bearer_header(client, user):
    token = create_access_token(data={"sub": str(user["id"])})

    response = client.get("/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_oauth_cookie_is_not_accepted_as_session(client, user):
    assert get_profile(client, create_oauth_cookie("state", "verifier")).status_code == 401


def test_logout_deletes_the_session_cookie(client):
    response = client.post("/logout")

    assert response.status_code == 204
    assert "max-age=0" in session_cookie_header(response).lower()


def test_logout_without_session_succeeds(client):
    assert client.post("/logout").status_code == 204


@pytest.mark.parametrize("path", ["/register", "/login"])
def test_password_routes_are_gone(client, path):
    assert client.post(path, data={"username": "a@example.com", "password": "x"}).status_code == 404


@pytest.mark.usefixtures("user")
def test_profile_with_token_without_exp_is_unauthorized(client):
    assert get_profile(client, signed_token({"sub": "1"})).status_code == 401


@pytest.mark.usefixtures("user")
def test_profile_with_expired_token_is_unauthorized(client):
    token = signed_token({"sub": "1", "exp": in_minutes(-1)})

    assert get_profile(client, token).status_code == 401


@pytest.mark.usefixtures("user")
def test_profile_with_token_without_sub_is_unauthorized(client):
    assert get_profile(client, signed_token({"exp": in_minutes(5)})).status_code == 401


@pytest.mark.usefixtures("user")
def test_profile_with_non_numeric_sub_is_unauthorized(client):
    token = signed_token({"sub": "abc", "exp": in_minutes(5)})

    assert get_profile(client, token).status_code == 401


@pytest.mark.usefixtures("user")
def test_profile_with_token_signed_by_another_key_is_unauthorized(client):
    token = signed_token({"sub": "1", "exp": in_minutes(5)}, key="another-key-of-at-least-32-bytes!")

    assert get_profile(client, token).status_code == 401


@pytest.mark.usefixtures("user")
def test_profile_with_unsigned_token_is_unauthorized(client):
    token = unsigned_token({"sub": "1", "exp": int(in_minutes(5).timestamp())})

    assert get_profile(client, token).status_code == 401
