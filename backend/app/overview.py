import httpx
from pydantic import ValidationError

from . import github, schemas

# GitHub's search syntax; the keys are the GraphQL variables and aliases in OVERVIEW_QUERY.
SEARCHES = {
    "assigned_issues": "is:open is:issue assignee:@me archived:false sort:updated-desc",
    "pull_requests": "is:open is:pr author:@me archived:false sort:updated-desc",
    "review_requests": "is:open is:pr review-requested:@me archived:false sort:updated-desc",
    "mentions": "is:open mentions:@me archived:false sort:updated-desc",
}

OVERVIEW_QUERY = """
query Overview(
  $assigned_issues: String!
  $pull_requests: String!
  $review_requests: String!
  $mentions: String!
) {
  assigned_issues: search(type: ISSUE, query: $assigned_issues, first: 50) { nodes { ...Item } }
  pull_requests: search(type: ISSUE, query: $pull_requests, first: 50) { nodes { ...Item } }
  review_requests: search(type: ISSUE, query: $review_requests, first: 50) { nodes { ...Item } }
  mentions: search(type: ISSUE, query: $mentions, first: 50) { nodes { ...Item } }
}

fragment Item on SearchResultItem {
  __typename
  ... on Issue {
    title
    number
    url
    updatedAt
    repository { nameWithOwner }
    author { __typename }
    comments(last: 1) { nodes { author { __typename } } }
  }
  ... on PullRequest {
    title
    number
    url
    updatedAt
    repository { nameWithOwner }
    author { __typename }
    comments(last: 1) { nodes { author { __typename } } }
    reviewDecision
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }
}
"""

KINDS = {"Issue": "issue", "PullRequest": "pull_request"}


def fetch_overview(client: httpx.Client, access_token: str) -> schemas.Overview:
    """Load the user's assigned issues, own pull requests, review requests and mentions."""
    data = github.graphql(client, access_token, OVERVIEW_QUERY, SEARCHES)
    try:
        return build_overview(data)
    except (KeyError, TypeError, ValidationError) as error:
        raise github.GitHubError("GitHub's overview response has an unexpected shape") from error


def build_overview(data: dict) -> schemas.Overview:
    """Turn the GraphQL search results into the overview."""
    mentions = [node for node in _nodes(data["mentions"]) if not _latest_activity_by_bot(node)]
    return schemas.Overview(
        assigned_issues=[_item(node) for node in _nodes(data["assigned_issues"])],
        pull_requests=[_pull_request_item(node) for node in _nodes(data["pull_requests"])],
        review_requests=[_item(node) for node in _nodes(data["review_requests"])],
        mentions=[_item(node) for node in mentions],
    )


def _nodes(search: dict | None) -> list[dict]:
    """Return the issues and pull requests of a search.

    GitHub sends null for a search or item it couldn't load (partial errors); those are skipped.
    """
    if search is None:
        return []
    return [node for node in search["nodes"] if node and node.get("__typename") in KINDS]


def _latest_activity_by_bot(node: dict) -> bool:
    """Tell whether the newest comment, or the item itself if it has none, comes from a bot."""
    comments = node["comments"]["nodes"]
    author = comments[-1]["author"] if comments else node["author"]
    return author is not None and author["__typename"] == "Bot"


def _item(node: dict) -> schemas.OverviewItem:
    """Turn a search result into an overview item."""
    return schemas.OverviewItem(**_item_fields(node))


def _pull_request_item(node: dict) -> schemas.PullRequestItem:
    """Turn a pull request search result into an item with CI status and review state."""
    commits = node["commits"]["nodes"]
    status_rollup = commits[0]["commit"]["statusCheckRollup"] if commits else None
    return schemas.PullRequestItem(
        **_item_fields(node),
        ci_status=status_rollup["state"] if status_rollup else None,
        review_decision=node["reviewDecision"],
    )


def _item_fields(node: dict) -> dict:
    """The fields that issues and pull requests share."""
    return {
        "kind": KINDS[node["__typename"]],
        "title": node["title"],
        "repository": node["repository"]["nameWithOwner"],
        "number": node["number"],
        "url": node["url"],
        "updated_at": node["updatedAt"],
    }
