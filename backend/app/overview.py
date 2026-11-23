import re
from urllib.parse import urlencode

import httpx
from pydantic import ValidationError

from . import github, schemas

# GitHub's search syntax for the four lists, without an order.
LIST_SEARCHES = {
    "assigned_issues": "is:open is:issue assignee:@me archived:false",
    "pull_requests": "is:open is:pr author:@me archived:false",
    "review_requests": "is:open is:pr review-requested:@me archived:false",
    "mentions": "is:open mentions:@me archived:false",
}

# The overview's searches, newest activity first; the keys are the GraphQL variables and
# aliases in OVERVIEW_QUERY.
SEARCHES = {name: f"{query} sort:updated-desc" for name, query in LIST_SEARCHES.items()}

ITEM_FRAGMENT = """
fragment Item on SearchResultItem {
  __typename
  ... on Issue {
    title
    number
    url
    updatedAt
    repository { nameWithOwner }
    labels(first: 10) { nodes { name color } }
    author { __typename }
    comments(last: 1) { nodes { author { __typename } } }
  }
  ... on PullRequest {
    title
    number
    url
    updatedAt
    repository { nameWithOwner }
    labels(first: 10) { nodes { name color } }
    author { __typename }
    comments(last: 1) { nodes { author { __typename } } }
    reviewDecision
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }
}
"""

OVERVIEW_QUERY = (
    """
query Overview(
  $assigned_issues: String!
  $pull_requests: String!
  $review_requests: String!
  $mentions: String!
) {
  assigned_issues: search(type: ISSUE, query: $assigned_issues, first: 50) {
    issueCount
    nodes { ...Item }
  }
  pull_requests: search(type: ISSUE, query: $pull_requests, first: 50) {
    issueCount
    nodes { ...Item }
  }
  review_requests: search(type: ISSUE, query: $review_requests, first: 50) {
    issueCount
    nodes { ...Item }
  }
  mentions: search(type: ISSUE, query: $mentions, first: 50) {
    issueCount
    nodes { ...Item }
  }
}
"""
    + ITEM_FRAGMENT
)

KINDS = {"Issue": "issue", "PullRequest": "pull_request"}

# GitHub label colours are six hex digits without "#".
LABEL_COLOR = re.compile(r"[0-9a-fA-F]{6}")
NEUTRAL_LABEL_COLOR = "ededed"


def fetch_overview(client: httpx.Client, access_token: str) -> schemas.Overview:
    """Load the user's assigned issues, own pull requests, review requests and mentions."""
    data = github.graphql(client, access_token, OVERVIEW_QUERY, SEARCHES)
    try:
        return build_overview(data)
    except (KeyError, TypeError, ValidationError) as error:
        raise github.GitHubError("GitHub's overview response has an unexpected shape") from error


def build_overview(data: dict) -> schemas.Overview:
    """Turn the GraphQL search results into the overview."""
    mentions = [node for node in search_nodes(data["mentions"]) if not latest_activity_by_bot(node)]
    return schemas.Overview(
        assigned_issues=[overview_item(node) for node in search_nodes(data["assigned_issues"])],
        pull_requests=[pull_request_item(node) for node in search_nodes(data["pull_requests"])],
        review_requests=[overview_item(node) for node in search_nodes(data["review_requests"])],
        mentions=[overview_item(node) for node in mentions],
        totals={section: _list_total(data[section], query) for section, query in SEARCHES.items()},
    )


def github_search_url(query: str) -> str:
    """The same search on github.com, where every match is listed."""
    return f"https://github.com/search?{urlencode({'q': query, 'type': 'issues'})}"


def _list_total(search: dict | None, query: str) -> dict:
    """How many items GitHub found for a list, and whether some weren't loaded."""
    total = search["issueCount"] if search else 0
    loaded = len(search["nodes"]) if search else 0
    return {"total": total, "has_more": total > loaded, "search_url": github_search_url(query)}


def search_nodes(search: dict | None) -> list[dict]:
    """Return the issues and pull requests of a search.

    GitHub sends null for a search or item it couldn't load (partial errors); those are skipped.
    """
    if search is None:
        return []
    return [node for node in search["nodes"] if node and node.get("__typename") in KINDS]


def latest_activity_by_bot(node: dict) -> bool:
    """Tell whether the newest comment, or the item itself if it has none, comes from a bot."""
    comments = node["comments"]["nodes"]
    author = comments[-1]["author"] if comments else node["author"]
    return author is not None and author["__typename"] == "Bot"


def overview_item(node: dict) -> schemas.OverviewItem:
    """Turn a search result into an overview item."""
    return schemas.OverviewItem(**item_fields(node))


def pull_request_item(node: dict) -> schemas.PullRequestItem:
    """Turn a pull request search result into an item with CI status and review state."""
    return schemas.PullRequestItem(
        **item_fields(node),
        ci_status=ci_status(node),
        review_decision=node["reviewDecision"],
    )


def ci_status(pull_request: dict) -> str | None:
    """The combined check state of the pull request's last commit, None without checks."""
    commits = pull_request["commits"]["nodes"]
    status_rollup = commits[0]["commit"]["statusCheckRollup"] if commits else None
    return status_rollup["state"] if status_rollup else None


def item_fields(node: dict) -> dict:
    """The fields that issues and pull requests share."""
    return {
        "kind": KINDS[node["__typename"]],
        "title": node["title"],
        "repository": node["repository"]["nameWithOwner"],
        "number": node["number"],
        "url": node["url"],
        "updated_at": node["updatedAt"],
        "labels": _labels(node),
    }


def _labels(node: dict) -> list[dict]:
    """The item's labels; a colour GitHub sends in an unexpected format becomes a neutral grey."""
    return [
        {
            "name": label["name"],
            "color": label["color"] if LABEL_COLOR.fullmatch(label["color"] or "") else NEUTRAL_LABEL_COLOR,
        }
        for label in node["labels"]["nodes"]
        if label
    ]
