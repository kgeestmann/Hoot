from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from backend.app import models
from backend.app.crypto import decrypt_token
from backend.app.database import SessionLocal
from backend.app.main import app, get_github_client
from backend.fake_github_server import data, server
from backend.fake_github_server.search import UnsupportedQuery, search
from backend.fake_github_server.server import create_app

NOW = datetime(2026, 11, 23, 12, 0, tzinfo=timezone.utc)


def numbers(found):
    return [item.number for item in found]


def test_search_combines_qualifiers_for_the_signed_in_user():
    found = search(data.items(NOW), "is:open is:pr author:@me archived:false", data.LOGIN)

    assert sorted(numbers(found)) == [7, 41, 44, 128, 312]


def test_search_sorts_as_asked():
    query = "org:demo-labs is:open is:issue no:assignee"

    oldest_first = search(data.items(NOW), f"{query} sort:created-asc", data.LOGIN)
    newest_first = search(data.items(NOW), f"{query} sort:created-desc", data.LOGIN)

    assert numbers(oldest_first) == list(reversed(numbers(newest_first)))
    assert oldest_first[0].created <= oldest_first[-1].created


def test_search_understands_negation_and_dates():
    waiting = search(data.items(NOW), "org:demo-labs is:pr review:required -is:draft", data.LOGIN)
    stale = search(data.items(NOW), "org:demo-orbit updated:<2026-09-24", data.LOGIN)

    assert all(not item.draft for item in waiting) and waiting
    assert numbers(stale) == [530]


def test_unknown_search_terms_are_refused():
    with pytest.raises(UnsupportedQuery, match="label:bug"):
        search(data.items(NOW), "is:open label:bug", data.LOGIN)


@pytest.fixture
def hoot(client):
    """The Hoot backend talking to a fresh fake GitHub, signed in as the fake user."""
    fake = TestClient(create_app())

    def fake_github_client():
        yield fake

    app.dependency_overrides[get_github_client] = fake_github_client
    login = client.get("/auth/github/login", follow_redirects=False)
    approved = fake.get(login.headers["location"], follow_redirects=False)
    callback = parse_qs(urlparse(approved.headers["location"]).query)
    signed_in = client.get(
        "/auth/github/callback",
        params={"code": callback["code"][0], "state": callback["state"][0]},
        follow_redirects=False,
    )
    assert signed_in.status_code == 302 and "error" not in signed_in.headers["location"]
    yield client
    app.dependency_overrides.pop(get_github_client, None)


def test_signing_in_against_the_fake_github(hoot):
    assert hoot.get("/profile").json()["login"] == data.LOGIN


def test_the_overview_comes_from_the_fake_data(hoot):
    overview = hoot.get("/overview").json()

    assert [len(overview[name]) for name in ("pull_requests", "review_requests", "mentions")] == [5, 4, 3]
    assert len(overview["assigned_issues"]) == 50
    assert overview["totals"]["assigned_issues"]["total"] == 62
    assert overview["totals"]["assigned_issues"]["has_more"] is True
    dashboard = next(item for item in overview["pull_requests"] if item["number"] == 41)
    assert dashboard["ci_status"] == "FAILURE"
    assert {check["state"] for check in dashboard["checks"]} == {"success", "failure"}


def test_a_list_pages_through_the_fake_data(hoot):
    first = hoot.get("/lists/assigned_issues").json()
    second = hoot.get("/lists/assigned_issues", params={"after": first["end_cursor"]}).json()

    assert (len(first["items"]), first["has_more"]) == (50, True)
    assert (len(second["items"]), second["has_more"]) == (12, False)


def test_the_team_view_and_installations_come_from_the_fake_data(hoot):
    team = hoot.get("/orgs/demo-labs/overview").json()
    access = hoot.get("/github/installations").json()

    assert team["failing_ci"]["total"] == 1
    assert team["unassigned_issues"]["total"] >= 2
    assert [entry["account"] for entry in access["installations"]] == ["demo-user", "demo-labs", "demo-orbit"]


def fake_tokens(fake: TestClient) -> dict:
    """Sign in at the fake GitHub directly and return the token response."""
    approved = fake.get(
        "/login/oauth/authorize",
        params={"redirect_uri": "http://hoot.test/callback", "state": "s"},
        follow_redirects=False,
    )
    code = parse_qs(urlparse(approved.headers["location"]).query)["code"][0]
    return fake.post("/login/oauth/access_token", data={"code": code}).json()


def test_a_refresh_token_gives_a_new_pair_once():
    fake = TestClient(create_app())
    first = fake_tokens(fake)

    renewed = fake.post(
        "/login/oauth/access_token",
        data={"grant_type": "refresh_token", "refresh_token": first["refresh_token"]},
    ).json()
    reused = fake.post(
        "/login/oauth/access_token",
        data={"grant_type": "refresh_token", "refresh_token": first["refresh_token"]},
    ).json()

    assert renewed["access_token"] != first["access_token"]
    assert fake.get("/user", headers={"Authorization": f"Bearer {renewed['access_token']}"}).status_code == 200
    assert reused == {"error": "bad_refresh_token"}


def test_unknown_codes_and_refresh_tokens_are_rejected():
    fake = TestClient(create_app())

    code = fake.post("/login/oauth/access_token", data={"code": "made-up"}).json()
    refresh = fake.post(
        "/login/oauth/access_token", data={"grant_type": "refresh_token", "refresh_token": "made-up"}
    ).json()

    assert code == {"error": "bad_verification_code"}
    assert refresh == {"error": "bad_refresh_token"}


def test_an_expired_access_token_is_refused(monkeypatch):
    monkeypatch.setattr(server, "TOKEN_SECONDS", -1)
    fake = TestClient(create_app())

    expired = fake_tokens(fake)["access_token"]

    assert fake.get("/user", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


@pytest.fixture
def short_tokens(monkeypatch):
    """Access tokens from the fake GitHub that Hoot counts as expired (under a minute left)."""
    monkeypatch.setattr(server, "TOKEN_SECONDS", 30)


def stored_access_token() -> str:
    with SessionLocal() as db:
        return decrypt_token(db.query(models.User).one().github_access_token)


def test_the_backend_refreshes_tokens_that_expire_quickly(short_tokens, hoot):
    before = stored_access_token()

    first = hoot.get("/overview")
    between = stored_access_token()
    second = hoot.get("/overview")

    assert (first.status_code, second.status_code) == (200, 200)
    assert len(second.json()["pull_requests"]) == 5
    assert len({before, between, stored_access_token()}) == 3
