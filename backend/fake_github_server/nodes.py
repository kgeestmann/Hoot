"""Fake items as GraphQL search nodes, with every field of Hoot's Item and TeamItem fragments."""

from datetime import datetime

from .data import LABEL_COLORS, FakeItem

# The fake data's check states, as a CheckRun's status and conclusion.
CHECK_RUNS = {
    "success": ("COMPLETED", "SUCCESS"),
    "failure": ("COMPLETED", "FAILURE"),
    "neutral": ("COMPLETED", "SKIPPED"),
    "pending": ("IN_PROGRESS", None),
}


def node(item: FakeItem) -> dict:
    """The item as GitHub's GraphQL API returns an Issue or PullRequest search result."""
    fields = {
        "__typename": "Issue" if item.kind == "issue" else "PullRequest",
        "title": item.title,
        "number": item.number,
        "url": item.url,
        "createdAt": _timestamp(item.created),
        "updatedAt": _timestamp(item.updated),
        "repository": {"nameWithOwner": item.repository},
        "labels": {"nodes": [{"name": name, "color": LABEL_COLORS[name]} for name in item.labels]},
        "author": {"__typename": "User", "login": item.author},
        "assignees": {"nodes": [{"login": login} for login in item.assignees]},
        "comments": {"nodes": _last_comment(item)},
        "commentCount": {"totalCount": item.comments},
        "milestone": {"title": item.milestone} if item.milestone else None,
    }
    if item.kind == "pull_request":
        fields |= _pull_request_fields(item)
    return fields


def _pull_request_fields(item: FakeItem) -> dict:
    return {
        "isDraft": item.draft,
        "reviewDecision": item.review_decision,
        "reviewRequests": {
            "nodes": [{"requestedReviewer": {"login": login}} for login in item.review_requests]
        },
        "latestReviews": {
            "nodes": [{"author": {"login": login}, "state": state} for login, state in item.reviews]
        },
        "commits": {"nodes": [{"commit": {"statusCheckRollup": _rollup(item)}}]},
    }


def _rollup(item: FakeItem) -> dict | None:
    if item.ci is None:
        return None
    contexts = []
    for name, state in item.checks:
        status, conclusion = CHECK_RUNS[state]
        contexts.append(
            {
                "__typename": "CheckRun",
                "name": name,
                "status": status,
                "conclusion": conclusion,
                "detailsUrl": f"https://github.com/{item.repository}/actions",
            }
        )
    return {"state": item.ci, "contexts": {"nodes": contexts}}


def _last_comment(item: FakeItem) -> list[dict]:
    if item.comments == 0:
        return []
    author = "Bot" if item.last_comment_by_bot else "User"
    return [{"author": {"__typename": author}}]


def _timestamp(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")
