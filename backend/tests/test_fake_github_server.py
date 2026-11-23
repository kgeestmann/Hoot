from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app, get_github_client
from backend.fake_github_server import data
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
