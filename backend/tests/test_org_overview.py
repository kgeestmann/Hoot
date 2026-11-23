import json
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest

from backend.app import github, org_overview
from backend.app.main import SESSION_COOKIE_NAME, create_access_token


def installation(login, account_type="Organization"):
    return {
        "id": 1,
        "account": {"login": login, "id": 7, "type": account_type},
        "repository_selection": "all",
        "html_url": f"https://github.com/organizations/{login}/settings/installations/1",
        "app_slug": "hoot-test",
    }


def installations(*entries):
    return httpx.Response(200, json={"total_count": len(entries), "installations": list(entries)})


def team_node(number=1, kind="Issue", author="alice", assignees=(), **fields):
    """A GraphQL search result as the team query returns it."""
    node = {
        "__typename": kind,
        "title": f"Item {number}",
        "number": number,
        "url": f"https://github.com/Octo-Org/hoot/issues/{number}",
        "createdAt": "2026-11-01T10:00:00Z",
        "updatedAt": "2026-11-20T10:00:00Z",
        "repository": {"nameWithOwner": "Octo-Org/hoot"},
        "author": {"login": author} if author else None,
        "assignees": {"nodes": [{"login": login} for login in assignees]},
        "labels": {"nodes": [{"name": "bug", "color": "d73a4a"}]},
        "commentCount": {"totalCount": 4},
        "milestone": {"title": "Sprint 3"},
    }
    if kind == "PullRequest":
        node["reviewDecision"] = "REVIEW_REQUIRED"
        node["commits"] = {"nodes": [{"commit": {"statusCheckRollup": {"state": "FAILURE"}}}]}
    return {**node, **fields}


def team_response(**lists):
    """GitHub's answer to the team query; each keyword is a list name with (total, nodes)."""
    data = {
        name: {"issueCount": lists.get(name, (0, []))[0], "nodes": lists.get(name, (0, []))[1]}
        for name in ("waiting_for_review", "failing_ci", "unassigned_issues", "stale")
    }
    return httpx.Response(200, json={"data": data})


@pytest.fixture
def signed_in(client, fake_github, user):
    """A signed-in user for whom Hoot is installed on Octo-Org."""
    client.cookies.set(SESSION_COOKIE_NAME, create_access_token(data={"sub": str(user["id"])}))
    fake_github.installations_response = installations(installation("Octo-Org"))
    fake_github.graphql_responses = [team_response()]
    return fake_github


def get_org(client, organization="octo-org"):
    return client.get(f"/orgs/{organization}/overview")


def sent_queries(fake_github):
    [request] = fake_github.requests_to(github.GRAPHQL_URL)
    return json.loads(request.content)["variables"]


def test_org_overview_requires_a_session(client, fake_github):
    assert get_org(client).status_code == 401
    assert fake_github.requests == []


def test_lists_have_totals_items_and_a_link_to_the_full_search(client, signed_in):
    signed_in.graphql_responses = [
        team_response(unassigned_issues=(42, [team_node(1), team_node(2)]))
    ]

    body = get_org(client).json()

    assert body["organization"] == "Octo-Org"
    assert body["stale_after_days"] == 60
    unassigned = body["unassigned_issues"]
    assert unassigned["total"] == 42
    assert [item["number"] for item in unassigned["items"]] == [1, 2]
    assert unassigned["search_url"].startswith("https://github.com/search?q=org%3AOcto-Org+")
    assert unassigned["search_url"].endswith("&type=issues")
    assert body["waiting_for_review"] == {
        "total": 0,
        "items": [],
        "search_url": body["waiting_for_review"]["search_url"],
    }


def test_items_show_author_assignees_and_age(client, signed_in):
    signed_in.graphql_responses = [
        team_response(stale=(1, [team_node(3, author="alice", assignees=["bob", "carol"])]))
    ]

    [item] = get_org(client).json()["stale"]["items"]

    assert item == {
        "kind": "issue",
        "title": "Item 3",
        "repository": "Octo-Org/hoot",
        "number": 3,
        "url": "https://github.com/Octo-Org/hoot/issues/3",
        "updated_at": "2026-11-20T10:00:00Z",
        "labels": [{"name": "bug", "color": "d73a4a"}],
        "comment_count": 4,
        "milestone": "Sprint 3",
        "created_at": "2026-11-01T10:00:00Z",
        "author": "alice",
        "assignees": ["bob", "carol"],
        "ci_status": None,
        "review_decision": None,
    }


def test_pull_requests_carry_ci_and_review_state(client, signed_in):
    signed_in.graphql_responses = [
        team_response(failing_ci=(1, [team_node(4, kind="PullRequest")]))
    ]

    [item] = get_org(client).json()["failing_ci"]["items"]

    assert item["kind"] == "pull_request"
    assert item["ci_status"] == "FAILURE"
    assert item["review_decision"] == "REVIEW_REQUIRED"


def test_deleted_authors_have_no_name(client, signed_in):
    signed_in.graphql_responses = [team_response(stale=(1, [team_node(5, author=None)]))]

    [item] = get_org(client).json()["stale"]["items"]

    assert item["author"] is None


def test_the_four_searches_target_the_organization(client, signed_in):
    get_org(client)

    queries = sent_queries(signed_in)
    assert queries == org_overview.searches("Octo-Org", datetime.now(timezone.utc).date())
    assert all(query.startswith("org:Octo-Org is:open archived:false") for query in queries.values())


def test_search_qualifiers_match_the_design():
    stale_before = (date(2026, 11, 21) - timedelta(days=60)).isoformat()

    queries = org_overview.searches("octo-org", date(2026, 11, 21))

    assert "is:pr review:required -is:draft" in queries["waiting_for_review"]
    assert "is:pr status:failure" in queries["failing_ci"]
    assert "is:issue no:assignee" in queries["unassigned_issues"]
    assert f"updated:<{stale_before}" in queries["stale"]
    assert stale_before == "2026-09-22"


def test_organizations_without_hoot_are_not_found(client, signed_in):
    signed_in.installations_response = installations(installation("Other-Org"))

    response = get_org(client)

    assert response.status_code == 404
    assert signed_in.requests_to(github.GRAPHQL_URL) == []


def test_a_user_account_is_not_an_organization(client, signed_in):
    signed_in.installations_response = installations(installation("octo-org", account_type="User"))

    assert get_org(client).status_code == 404


@pytest.mark.parametrize("organization", ["-octo", "octo-", "octo_org", "a" * 40])
def test_invalid_organization_names_are_rejected(client, signed_in, organization):
    response = get_org(client, organization)

    assert response.status_code == 422
    assert signed_in.requests == []


def test_github_failure_answers_502(client, signed_in):
    signed_in.graphql_responses = [httpx.Response(500)]

    assert get_org(client).status_code == 502


def test_unexpected_answer_from_github_answers_502(client, signed_in):
    signed_in.graphql_responses = [
        httpx.Response(200, json={"data": {"waiting_for_review": {"nodes": []}}})
    ]

    assert get_org(client).status_code == 502


def test_the_team_query_asks_for_labels():
    assert "labels(first: 10) { nodes { name color } }" in org_overview.ORG_OVERVIEW_QUERY
