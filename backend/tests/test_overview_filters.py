import pytest

from backend.app import models
from backend.app.crypto import encrypt_token
from backend.app.database import SessionLocal
from backend.app.main import SESSION_COOKIE_NAME, create_access_token


def sign_in_as(client, user_id):
    client.cookies.set(SESSION_COOKIE_NAME, create_access_token(data={"sub": str(user_id)}))


def put_filters(client, hidden):
    return client.put("/overview/filters", json={"hidden": hidden})


def other_user():
    """A second signed-up user; returns its id."""
    with SessionLocal() as db:
        stored = models.User(github_id=1, login="hubot", github_access_token=encrypt_token("gho_other"))
        db.add(stored)
        db.commit()
        return stored.id


@pytest.mark.parametrize("method", ["get", "put"])
def test_filters_require_a_session(client, method):
    response = client.request(method, "/overview/filters", json={"hidden": []})

    assert response.status_code == 401


def test_nothing_is_hidden_at_first(client, user):
    sign_in_as(client, user["id"])

    assert client.get("/overview/filters").json() == {"hidden": []}


def test_hidden_owners_and_repositories_are_stored(client, user):
    sign_in_as(client, user["id"])

    response = put_filters(client, ["dipt-pa1469-ht26", "kgeestmann/old-repo"])

    assert response.status_code == 200
    assert response.json() == {"hidden": ["dipt-pa1469-ht26", "kgeestmann/old-repo"]}
    assert client.get("/overview/filters").json() == response.json()


def test_scopes_are_lowercased_trimmed_sorted_and_deduplicated(client, user):
    sign_in_as(client, user["id"])

    response = put_filters(client, [" Octo-Org ", "octo-org", "Octo/Hoot.js"])

    assert response.json() == {"hidden": ["octo-org", "octo/hoot.js"]}


def test_saving_replaces_the_previous_filters(client, user):
    sign_in_as(client, user["id"])
    put_filters(client, ["octo-org", "octo/hoot"])

    put_filters(client, ["octo/hoot"])

    assert client.get("/overview/filters").json() == {"hidden": ["octo/hoot"]}


def test_filters_belong_to_one_user(client, user):
    sign_in_as(client, user["id"])
    put_filters(client, ["octo-org"])

    sign_in_as(client, other_user())

    assert client.get("/overview/filters").json() == {"hidden": []}


@pytest.mark.parametrize(
    "scope",
    ["", "-octo", "octo-", "octo org", "octo/hoot/issues", "octo/", "/hoot", "a" * 141, "<script>"],
)
def test_invalid_scopes_are_rejected(client, user, scope):
    sign_in_as(client, user["id"])

    response = put_filters(client, [scope])

    assert response.status_code == 422
    assert client.get("/overview/filters").json() == {"hidden": []}


def test_too_many_scopes_are_rejected(client, user):
    sign_in_as(client, user["id"])

    response = put_filters(client, [f"owner-{number}" for number in range(501)])

    assert response.status_code == 422
