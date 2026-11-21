def login(client, email, password):
    """Log in with form data, as the frontend does, and return the response."""
    return client.post("/login", data={"username": email, "password": password})


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
