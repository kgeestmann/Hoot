import json
import time

import httpx
import pytest

from backend.app import github, models, overview
from backend.app.crypto import decrypt_token, encrypt_token
from backend.app.database import SessionLocal
from backend.app.main import SESSION_COOKIE_NAME, create_access_token
from backend.tests.fake_github import ACCESS_TOKEN, REFRESH_TOKEN

STORED_ACCESS_TOKEN = "gho_stored-token"
STORED_REFRESH_TOKEN = "ghr_stored-refresh-token"
IN_AN_HOUR = int(time.time()) + 3600
AN_HOUR_AGO = int(time.time()) - 3600


def store_user(
    access_token_expires_at=IN_AN_HOUR,
    refresh_token=STORED_REFRESH_TOKEN,
    refresh_token_expires_at=IN_AN_HOUR,
):
    """Store a signed-in user with GitHub tokens and return its id."""
    with SessionLocal() as db:
        user = models.User(
            github_id=4242,
            login="octocat",
            github_access_token=encrypt_token(STORED_ACCESS_TOKEN),
            github_access_token_expires_at=access_token_expires_at,
            github_refresh_token=encrypt_token(refresh_token) if refresh_token else None,
            github_refresh_token_expires_at=refresh_token_expires_at,
        )
        db.add(user)
        db.commit()
        return user.id


def load_user(user_id):
    with SessionLocal() as db:
        return db.get(models.User, user_id)


def get_overview(client, user_id):
    """Request /overview with a session cookie for the given user."""
    client.cookies.set(SESSION_COOKIE_NAME, create_access_token(data={"sub": str(user_id)}))
    return client.get("/overview")


def issue(number=1, last_commenter="User", author="User", labels=(), **fields):
    """A GraphQL search result for an issue; labels are (name, color) pairs."""
    comments = [{"author": {"__typename": last_commenter}}] if last_commenter else []
    return {
        "labels": {"nodes": [{"name": name, "color": color} for name, color in labels]},
        "commentCount": {"totalCount": 0},
        "milestone": None,
        "__typename": "Issue",
        "title": "Login button does nothing",
        "number": number,
        "url": f"https://github.com/octo/hoot/issues/{number}",
        "updatedAt": "2026-11-20T10:00:00Z",
        "repository": {"nameWithOwner": "octo/hoot"},
        "author": {"__typename": author},
        "comments": {"nodes": comments},
        **fields,
    }


def pull_request(
    number=2, ci_status="SUCCESS", review_decision="APPROVED", contexts=(), draft=False,
    requested=(), reviews=(), **fields,
):
    """A GraphQL search result for a pull request; `reviews` are (login, state) pairs."""
    rollup = {"state": ci_status, "contexts": {"nodes": list(contexts)}} if ci_status else None
    return {
        **issue(number, **fields),
        "__typename": "PullRequest",
        "title": "Add the overview API",
        "url": f"https://github.com/octo/hoot/pull/{number}",
        "isDraft": draft,
        "reviewDecision": review_decision,
        "reviewRequests": {"nodes": [{"requestedReviewer": reviewer} for reviewer in requested]},
        "latestReviews": {"nodes": [{"author": {"login": login}, "state": state} for login, state in reviews]},
        "commits": {"nodes": [{"commit": {"statusCheckRollup": rollup}}]},
    }


def graphql_response(assigned_issues=(), pull_requests=(), review_requests=(), mentions=(), totals=None):
    """GitHub's answer to the overview query; `totals` maps a list to an issueCount to report."""
    totals = totals or {}
    lists = {
        "assigned_issues": assigned_issues,
        "pull_requests": pull_requests,
        "review_requests": review_requests,
        "mentions": mentions,
    }
    data = {
        name: {
            "issueCount": totals.get(name, len(nodes)),
            "pageInfo": {"hasNextPage": totals.get(name, len(nodes)) > len(nodes)},
            "nodes": list(nodes),
        }
        for name, nodes in lists.items()
    }
    return httpx.Response(200, json={"data": data})


BAD_CREDENTIALS = httpx.Response(401, json={"message": "Bad credentials"})


@pytest.fixture(autouse=True)
def empty_overview(fake_github):
    """Let GitHub answer with an empty overview unless a test sets something else."""
    fake_github.graphql_responses = [graphql_response()]


def refreshed_tokens_response():
    return httpx.Response(
        200,
        json={
            "access_token": ACCESS_TOKEN,
            "expires_in": 28800,
            "refresh_token": REFRESH_TOKEN,
            "refresh_token_expires_in": 15811200,
        },
    )


def graphql_tokens(fake_github):
    """Return the access tokens the GraphQL requests were sent with."""
    return [
        request.headers["authorization"].removeprefix("Bearer ")
        for request in fake_github.requests_to(github.GRAPHQL_URL)
    ]


def assert_signed_out(response, user_id):
    """The user has to sign in again: 401, session cookie deleted, GitHub tokens forgotten."""
    assert response.status_code == 401
    session_cookie = [h for h in response.headers.get_list("set-cookie") if h.startswith(f"{SESSION_COOKIE_NAME}=")]
    assert len(session_cookie) == 1 and "Max-Age=0" in session_cookie[0]
    user = load_user(user_id)
    assert user.github_access_token is None
    assert user.github_refresh_token is None


# --- Overview content ---


def test_overview_requires_a_session(client, fake_github):
    assert client.get("/overview").status_code == 401
    assert fake_github.requests == []


def test_overview_lists_everything_waiting_on_the_user(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(
            assigned_issues=[issue(1)],
            pull_requests=[pull_request(2, ci_status="FAILURE", review_decision="CHANGES_REQUESTED")],
            review_requests=[pull_request(3)],
            mentions=[issue(4)],
        )
    ]

    response = get_overview(client, store_user())

    assert response.status_code == 200
    body = response.json()
    assert body["assigned_issues"] == [
        {
            "kind": "issue",
            "title": "Login button does nothing",
            "repository": "octo/hoot",
            "number": 1,
            "url": "https://github.com/octo/hoot/issues/1",
            "updated_at": "2026-11-20T10:00:00Z",
            "labels": [],
            "comment_count": 0,
            "milestone": None,
        }
    ]
    assert body["pull_requests"] == [
        {
            "kind": "pull_request",
            "title": "Add the overview API",
            "repository": "octo/hoot",
            "number": 2,
            "url": "https://github.com/octo/hoot/pull/2",
            "updated_at": "2026-11-20T10:00:00Z",
            "labels": [],
            "comment_count": 0,
            "milestone": None,
            "ci_status": "FAILURE",
            "review_decision": "CHANGES_REQUESTED",
            "draft": False,
            "reviewers": [],
            "checks": [],
        }
    ]
    assert [item["number"] for item in body["review_requests"]] == [3]
    assert [item["number"] for item in body["mentions"]] == [4]


def test_overview_runs_the_four_searches_with_the_users_token(client, fake_github):
    get_overview(client, store_user())

    [request] = fake_github.requests_to(github.GRAPHQL_URL)
    assert request.headers["authorization"] == f"Bearer {STORED_ACCESS_TOKEN}"
    variables = json.loads(request.content)["variables"]
    assert variables == overview.SEARCHES
    assert all("is:open" in query and "archived:false" in query for query in variables.values())
    assert "is:issue assignee:@me" in variables["assigned_issues"]
    assert "is:pr author:@me" in variables["pull_requests"]
    assert "is:pr review-requested:@me" in variables["review_requests"]
    assert "mentions:@me" in variables["mentions"]


def test_mentions_skip_items_whose_latest_comment_is_from_a_bot(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(mentions=[issue(1, last_commenter="Bot"), issue(2, last_commenter="User")])
    ]

    body = get_overview(client, store_user()).json()

    assert [item["number"] for item in body["mentions"]] == [2]


def test_mentions_skip_uncommented_items_opened_by_a_bot(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(
            mentions=[issue(1, last_commenter=None, author="Bot"), issue(2, last_commenter=None)]
        )
    ]

    body = get_overview(client, store_user()).json()

    assert [item["number"] for item in body["mentions"]] == [2]


def test_bot_activity_only_filters_mentions(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(assigned_issues=[issue(1, last_commenter="Bot")])
    ]

    body = get_overview(client, store_user()).json()

    assert [item["number"] for item in body["assigned_issues"]] == [1]


def test_pull_request_without_checks_or_required_review(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(pull_requests=[pull_request(ci_status=None, review_decision=None)])
    ]

    [item] = get_overview(client, store_user()).json()["pull_requests"]

    assert item["ci_status"] is None
    assert item["review_decision"] is None


def test_items_github_could_not_load_are_skipped(client, fake_github):
    data = graphql_response(assigned_issues=[issue(1)]).json()["data"]
    data["assigned_issues"]["nodes"].append(None)
    data["mentions"] = None
    fake_github.graphql_responses = [
        httpx.Response(200, json={"data": data, "errors": [{"message": "Resource not accessible"}]})
    ]

    response = get_overview(client, store_user())

    assert response.status_code == 200
    assert [item["number"] for item in response.json()["assigned_issues"]] == [1]
    assert response.json()["mentions"] == []


def test_items_carry_their_labels_with_colours(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(assigned_issues=[issue(1, labels=[("bug", "d73a4a"), ("good first issue", "7057FF")])])
    ]

    [item] = get_overview(client, store_user()).json()["assigned_issues"]

    assert item["labels"] == [
        {"name": "bug", "color": "d73a4a"},
        {"name": "good first issue", "color": "7057FF"},
    ]


def test_label_colours_in_an_unexpected_format_become_grey(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(assigned_issues=[issue(1, labels=[("odd", "red;}"), ("empty", None)])])
    ]

    [item] = get_overview(client, store_user()).json()["assigned_issues"]

    assert [label["color"] for label in item["labels"]] == ["ededed", "ededed"]


def test_the_queries_ask_for_labels():
    assert "labels(first: 10) { nodes { name color } }" in overview.OVERVIEW_QUERY


def test_each_list_has_its_total_and_a_link_to_the_search(client, fake_github):
    fake_github.graphql_responses = [graphql_response(assigned_issues=[issue(1), issue(2)])]

    totals = get_overview(client, store_user()).json()["totals"]

    assert totals["assigned_issues"]["total"] == 2
    assert totals["assigned_issues"]["has_more"] is False
    assert totals["assigned_issues"]["search_url"] == (
        "https://github.com/search?q=is%3Aopen+is%3Aissue+assignee%3A%40me+archived%3Afalse"
        "+sort%3Aupdated-desc&type=issues"
    )
    assert totals["mentions"] == {
        "total": 0,
        "has_more": False,
        "search_url": totals["mentions"]["search_url"],
    }


def test_a_list_cut_off_by_github_says_so(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(
            review_requests=[issue(number) for number in range(1, 51)],
            totals={"review_requests": 70},
        )
    ]

    body = get_overview(client, store_user()).json()

    assert len(body["review_requests"]) == 50
    assert body["totals"]["review_requests"]["total"] == 70
    assert body["totals"]["review_requests"]["has_more"] is True


def test_the_query_asks_for_the_totals():
    assert overview.OVERVIEW_QUERY.count("issueCount") == 4
    assert overview.OVERVIEW_QUERY.count("pageInfo { hasNextPage }") == 4


def test_a_count_that_includes_items_github_no_longer_returns_is_not_more(client, fake_github):
    response = graphql_response().json()
    # Right after a merge GitHub's search can still count the pull request without returning it.
    response["data"]["pull_requests"] = {"issueCount": 1, "pageInfo": {"hasNextPage": False}, "nodes": []}
    fake_github.graphql_responses = [httpx.Response(200, json=response)]

    body = get_overview(client, store_user()).json()

    assert body["pull_requests"] == []
    assert body["totals"]["pull_requests"]["total"] == 1
    assert body["totals"]["pull_requests"]["has_more"] is False


def test_items_carry_their_comment_count_and_milestone(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(
            assigned_issues=[issue(1, commentCount={"totalCount": 7}, milestone={"title": "v1.0"})]
        )
    ]

    [item] = get_overview(client, store_user()).json()["assigned_issues"]

    assert item["comment_count"] == 7
    assert item["milestone"] == "v1.0"


def test_pull_requests_list_each_check_with_a_simple_state(client, fake_github):
    contexts = [
        {"__typename": "CheckRun", "name": "backend", "status": "COMPLETED", "conclusion": "SUCCESS", "detailsUrl": "https://ci/1"},
        {"__typename": "CheckRun", "name": "lint", "status": "COMPLETED", "conclusion": "TIMED_OUT", "detailsUrl": "https://ci/2"},
        {"__typename": "CheckRun", "name": "e2e", "status": "IN_PROGRESS", "conclusion": None, "detailsUrl": None},
        {"__typename": "CheckRun", "name": "docs", "status": "COMPLETED", "conclusion": "SKIPPED", "detailsUrl": None},
        {"__typename": "StatusContext", "context": "deploy", "state": "PENDING", "targetUrl": "https://ci/3"},
        {"__typename": "StatusContext", "context": "coverage", "state": "ERROR", "targetUrl": None},
    ]
    fake_github.graphql_responses = [graphql_response(pull_requests=[pull_request(contexts=contexts)])]

    [item] = get_overview(client, store_user()).json()["pull_requests"]

    assert item["checks"] == [
        {"name": "backend", "state": "success", "url": "https://ci/1"},
        {"name": "lint", "state": "failure", "url": "https://ci/2"},
        {"name": "e2e", "state": "pending", "url": None},
        {"name": "docs", "state": "neutral", "url": None},
        {"name": "deploy", "state": "pending", "url": "https://ci/3"},
        {"name": "coverage", "state": "failure", "url": None},
    ]


def test_pull_requests_show_reviewers_and_draft_state(client, fake_github):
    fake_github.graphql_responses = [
        graphql_response(
            pull_requests=[
                pull_request(
                    draft=True,
                    reviews=[("alice", "APPROVED"), ("bob", "CHANGES_REQUESTED")],
                    requested=[{"login": "bob"}, {"name": "frontend-team"}],
                )
            ]
        )
    ]

    [item] = get_overview(client, store_user()).json()["pull_requests"]

    assert item["draft"] is True
    assert item["reviewers"] == [
        {"name": "alice", "state": "APPROVED"},
        {"name": "bob", "state": "REQUESTED"},
        {"name": "frontend-team", "state": "REQUESTED"},
    ]


def test_github_tokens_never_appear_in_the_overview(client, fake_github):
    fake_github.graphql_responses = [graphql_response(assigned_issues=[issue(1)])]

    response = get_overview(client, store_user())

    assert STORED_ACCESS_TOKEN not in response.text
    assert STORED_REFRESH_TOKEN not in response.text


# --- GitHub failures ---


@pytest.mark.parametrize(
    "graphql_answer",
    [
        httpx.Response(500),
        httpx.Response(200, json={"errors": [{"message": "Something went wrong"}]}),
        httpx.Response(200, json={"data": {"assigned_issues": {"nodes": [{"__typename": "Issue"}]}}}),
    ],
    ids=["server-error", "errors-without-data", "unexpected-shape"],
)
def test_github_failures_answer_502_and_keep_the_session(client, fake_github, graphql_answer):
    fake_github.graphql_responses = [graphql_answer]
    user_id = store_user()

    response = get_overview(client, user_id)

    assert response.status_code == 502
    assert response.headers.get_list("set-cookie") == []
    assert decrypt_token(load_user(user_id).github_access_token) == STORED_ACCESS_TOKEN


def test_unreachable_github_answers_502(client, fake_github):
    fake_github.unreachable = True

    assert get_overview(client, store_user()).status_code == 502


# --- Token refresh ---


def test_expired_access_token_is_refreshed_before_the_call(client, fake_github):
    fake_github.token_response = refreshed_tokens_response()
    user_id = store_user(access_token_expires_at=AN_HOUR_AGO)

    response = get_overview(client, user_id)

    assert response.status_code == 200
    assert graphql_tokens(fake_github) == [ACCESS_TOKEN]
    [refresh_request] = fake_github.requests_to(github.TOKEN_URL)
    form = dict(httpx.QueryParams(refresh_request.content.decode()))
    assert form == {
        "client_id": "test-client-id",
        "client_secret": "test-client-secret",
        "grant_type": "refresh_token",
        "refresh_token": STORED_REFRESH_TOKEN,
    }


def test_refreshed_tokens_are_stored_encrypted(client, fake_github):
    fake_github.token_response = refreshed_tokens_response()
    user_id = store_user(access_token_expires_at=AN_HOUR_AGO)

    get_overview(client, user_id)

    user = load_user(user_id)
    assert user.github_access_token != ACCESS_TOKEN
    assert decrypt_token(user.github_access_token) == ACCESS_TOKEN
    assert decrypt_token(user.github_refresh_token) == REFRESH_TOKEN
    assert abs(user.github_access_token_expires_at - (time.time() + 28800)) < 10
    assert abs(user.github_refresh_token_expires_at - (time.time() + 15811200)) < 10


def test_token_rejected_by_github_is_refreshed_and_the_call_retried(client, fake_github):
    fake_github.token_response = refreshed_tokens_response()
    fake_github.graphql_responses = [BAD_CREDENTIALS, graphql_response(assigned_issues=[issue(1)])]

    response = get_overview(client, store_user())

    assert response.status_code == 200
    assert graphql_tokens(fake_github) == [STORED_ACCESS_TOKEN, ACCESS_TOKEN]
    assert [item["number"] for item in response.json()["assigned_issues"]] == [1]


def test_token_without_expiry_is_not_refreshed(client, fake_github):
    get_overview(client, store_user(access_token_expires_at=None))

    assert fake_github.requests_to(github.TOKEN_URL) == []


def test_rejected_refresh_token_signs_the_user_out(client, fake_github):
    fake_github.token_response = httpx.Response(200, json={"error": "bad_refresh_token"})
    user_id = store_user(access_token_expires_at=AN_HOUR_AGO)

    response = get_overview(client, user_id)

    assert_signed_out(response, user_id)
    assert fake_github.requests_to(github.GRAPHQL_URL) == []


def test_expired_refresh_token_signs_the_user_out_without_asking_github(client, fake_github):
    user_id = store_user(access_token_expires_at=AN_HOUR_AGO, refresh_token_expires_at=AN_HOUR_AGO)

    response = get_overview(client, user_id)

    assert_signed_out(response, user_id)
    assert fake_github.requests == []


def test_revoked_token_without_refresh_token_signs_the_user_out(client, fake_github):
    fake_github.graphql_responses = [BAD_CREDENTIALS]
    user_id = store_user(refresh_token=None, refresh_token_expires_at=None)

    assert_signed_out(get_overview(client, user_id), user_id)


def test_token_still_rejected_after_refresh_signs_the_user_out(client, fake_github):
    fake_github.token_response = refreshed_tokens_response()
    fake_github.graphql_responses = [BAD_CREDENTIALS]
    user_id = store_user()

    response = get_overview(client, user_id)

    assert_signed_out(response, user_id)
    assert graphql_tokens(fake_github) == [STORED_ACCESS_TOKEN, ACCESS_TOKEN]


def test_user_without_tokens_has_to_sign_in_again(client, fake_github):
    fake_github.token_response = httpx.Response(200, json={"error": "bad_refresh_token"})
    user_id = store_user(access_token_expires_at=AN_HOUR_AGO)
    get_overview(client, user_id)

    response = get_overview(client, user_id)

    assert response.status_code == 401
    assert len(fake_github.requests) == 1


def test_unreachable_token_endpoint_keeps_the_tokens(client, fake_github):
    fake_github.unreachable = True
    user_id = store_user(access_token_expires_at=AN_HOUR_AGO)

    response = get_overview(client, user_id)

    assert response.status_code == 502
    assert decrypt_token(load_user(user_id).github_refresh_token) == STORED_REFRESH_TOKEN
