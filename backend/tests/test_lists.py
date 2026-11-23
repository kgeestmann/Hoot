import json

import httpx
import pytest

from backend.app import github, lists
from backend.app.main import SESSION_COOKIE_NAME, create_access_token


def node(number, kind="Issue", last_commenter="User", **fields):
    """A GraphQL search result as the list query returns it."""
    result = {
        "__typename": kind,
        "title": f"Item {number}",
        "number": number,
        "url": f"https://github.com/octo/hoot/issues/{number}",
        "updatedAt": "2026-11-20T10:00:00Z",
        "repository": {"nameWithOwner": "octo/hoot"},
        "labels": {"nodes": []},
        "commentCount": {"totalCount": 0},
        "milestone": None,
        "author": {"__typename": "User"},
        "comments": {"nodes": [{"author": {"__typename": last_commenter}}]},
    }
    if kind == "PullRequest":
        result["reviewDecision"] = "APPROVED"
        result["isDraft"] = False
        result["reviewRequests"] = {"nodes": []}
        result["latestReviews"] = {"nodes": []}
        result["commits"] = {
            "nodes": [{"commit": {"statusCheckRollup": {"state": "SUCCESS", "contexts": {"nodes": []}}}}]
        }
    return {**result, **fields}


def list_response(nodes, total=None, has_next_page=False, end_cursor="Y3Vyc29yOjUw"):
    """GitHub's answer to the list query."""
    return httpx.Response(
        200,
        json={
            "data": {
                "search": {
                    "issueCount": len(nodes) if total is None else total,
                    "pageInfo": {"hasNextPage": has_next_page, "endCursor": end_cursor},
                    "nodes": nodes,
                }
            }
        },
    )


@pytest.fixture
def signed_in(client, fake_github, user):
    client.cookies.set(SESSION_COOKIE_NAME, create_access_token(data={"sub": str(user["id"])}))
    fake_github.graphql_responses = [list_response([])]
    return fake_github


def sent_variables(fake_github):
    [request] = fake_github.requests_to(github.GRAPHQL_URL)
    return json.loads(request.content)["variables"]


def test_lists_require_a_session(client, fake_github):
    assert client.get("/lists/mentions").status_code == 401
    assert fake_github.requests == []


def test_a_page_has_items_total_and_where_to_continue(client, signed_in):
    signed_in.graphql_responses = [
        list_response([node(1), node(2)], total=120, has_next_page=True, end_cursor="Y3Vyc29yOjUw")
    ]

    body = client.get("/lists/assigned_issues").json()

    assert [item["number"] for item in body["items"]] == [1, 2]
    assert body["total"] == 120
    assert body["has_more"] is True
    assert body["end_cursor"] == "Y3Vyc29yOjUw"
    assert body["search_url"].startswith("https://github.com/search?q=is%3Aopen+is%3Aissue")


def test_the_last_page_has_no_cursor_to_continue(client, signed_in):
    signed_in.graphql_responses = [list_response([node(1)], end_cursor=None)]

    body = client.get("/lists/assigned_issues").json()

    assert body["has_more"] is False
    assert body["end_cursor"] is None


@pytest.mark.parametrize(
    ("sort", "qualifier"),
    [("updated", "sort:updated-desc"), ("oldest", "sort:created-asc"), ("created", "sort:created-desc")],
)
def test_the_search_uses_the_chosen_order(client, signed_in, sort, qualifier):
    client.get(f"/lists/review_requests?sort={sort}")

    query = sent_variables(signed_in)["query"]
    assert query == f"is:open is:pr review-requested:@me archived:false {qualifier}"


def test_the_newest_activity_comes_first_by_default(client, signed_in):
    client.get("/lists/assigned_issues")

    assert sent_variables(signed_in)["query"].endswith("sort:updated-desc")


def test_the_next_page_continues_after_the_cursor(client, signed_in):
    client.get("/lists/mentions?after=Y3Vyc29yOjUw")

    assert sent_variables(signed_in)["after"] == "Y3Vyc29yOjUw"


def test_the_first_page_starts_at_the_beginning(client, signed_in):
    client.get("/lists/mentions")

    assert sent_variables(signed_in)["after"] is None


def test_own_pull_requests_carry_ci_and_review_state(client, signed_in):
    signed_in.graphql_responses = [list_response([node(1, kind="PullRequest")])]

    [item] = client.get("/lists/pull_requests").json()["items"]

    assert item["ci_status"] == "SUCCESS"
    assert item["review_decision"] == "APPROVED"


def test_mentions_skip_items_whose_latest_comment_is_from_a_bot(client, signed_in):
    signed_in.graphql_responses = [list_response([node(1, last_commenter="Bot"), node(2)])]

    body = client.get("/lists/mentions").json()

    assert [item["number"] for item in body["items"]] == [2]


@pytest.mark.parametrize(
    "path",
    [
        "/lists/everything",
        "/lists/mentions?sort=random",
        "/lists/mentions?after=not%20a%20cursor",
        "/lists/mentions?after=" + "a" * 201,
    ],
)
def test_invalid_lists_orders_and_cursors_are_rejected(client, signed_in, path):
    assert client.get(path).status_code == 422
    assert signed_in.requests == []


def test_unexpected_answer_from_github_answers_502(client, signed_in):
    signed_in.graphql_responses = [httpx.Response(200, json={"data": {"search": {"nodes": []}}})]

    assert client.get("/lists/mentions").status_code == 502


def test_the_list_query_pages_through_the_search():
    assert "after: $after" in lists.LIST_QUERY
    assert "pageInfo { hasNextPage endCursor }" in lists.LIST_QUERY
