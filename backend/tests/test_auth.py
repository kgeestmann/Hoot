import base64
import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from backend.app.config import ALGORITHM, SECRET_KEY


def login(client, email, password):
    """Log in with form data, as the frontend does, and return the response."""
    return client.post("/login", data={"username": email, "password": password})


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
    """Request /profile with the given bearer token and return the response."""
    return client.get("/profile", headers={"Authorization": f"Bearer {token}"})


def test_register_returns_the_new_user(client):
    response = client.post("/register", json={"email": "new@example.com", "password": "geheim123"})

    assert response.status_code == 200
    assert response.json() == {"id": 1, "email": "new@example.com"}


def test_register_twice_with_the_same_email_is_a_conflict(client, registered_user):
    response = client.post("/register", json=registered_user)

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}


def test_register_rejects_passwords_longer_than_72_bytes(client):
    response = client.post("/register", json={"email": "long@example.com", "password": "a" * 73})

    assert response.status_code == 422


def test_login_with_wrong_password_is_unauthorized(client, registered_user):
    response = login(client, registered_user["email"], "falsch")

    assert response.status_code == 401


def test_login_with_unknown_email_is_unauthorized(client):
    response = login(client, "nobody@example.com", "geheim123")

    assert response.status_code == 401


def test_profile_returns_the_logged_in_user(client, registered_user):
    token = login(client, registered_user["email"], registered_user["password"]).json()["access_token"]

    response = client.get("/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == registered_user["email"]


def test_profile_without_token_is_unauthorized(client):
    assert client.get("/profile").status_code == 401


def test_profile_with_invalid_token_is_unauthorized(client):
    response = client.get("/profile", headers={"Authorization": "Bearer not-a-jwt"})

    assert response.status_code == 401


@pytest.mark.usefixtures("registered_user")
def test_profile_with_token_without_exp_is_unauthorized(client):
    assert get_profile(client, signed_token({"sub": "1"})).status_code == 401


@pytest.mark.usefixtures("registered_user")
def test_profile_with_expired_token_is_unauthorized(client):
    token = signed_token({"sub": "1", "exp": in_minutes(-1)})

    assert get_profile(client, token).status_code == 401


@pytest.mark.usefixtures("registered_user")
def test_profile_with_token_without_sub_is_unauthorized(client):
    assert get_profile(client, signed_token({"exp": in_minutes(5)})).status_code == 401


@pytest.mark.usefixtures("registered_user")
def test_profile_with_non_numeric_sub_is_unauthorized(client):
    token = signed_token({"sub": "abc", "exp": in_minutes(5)})

    assert get_profile(client, token).status_code == 401


@pytest.mark.usefixtures("registered_user")
def test_profile_with_token_signed_by_another_key_is_unauthorized(client):
    token = signed_token({"sub": "1", "exp": in_minutes(5)}, key="another-key-of-at-least-32-bytes!")

    assert get_profile(client, token).status_code == 401


@pytest.mark.usefixtures("registered_user")
def test_profile_with_unsigned_token_is_unauthorized(client):
    token = unsigned_token({"sub": "1", "exp": int(in_minutes(5).timestamp())})

    assert get_profile(client, token).status_code == 401
