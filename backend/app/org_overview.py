"""The team view of an organization: lists of work items, never statistics per person (#28)."""

from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from pydantic import ValidationError

from . import github, schemas
from .overview import ci_status, item_fields, search_nodes

STALE_AFTER_DAYS = 60

ORG_OVERVIEW_QUERY = """
query OrgOverview(
  $waiting_for_review: String!
  $failing_ci: String!
  $unassigned_issues: String!
  $stale: String!
) {
  waiting_for_review: search(type: ISSUE, query: $waiting_for_review, first: 20) {
    issueCount
    nodes { ...TeamItem }
  }
  failing_ci: search(type: ISSUE, query: $failing_ci, first: 20) {
    issueCount
    nodes { ...TeamItem }
  }
  unassigned_issues: search(type: ISSUE, query: $unassigned_issues, first: 20) {
    issueCount
    nodes { ...TeamItem }
  }
  stale: search(type: ISSUE, query: $stale, first: 20) {
    issueCount
    nodes { ...TeamItem }
  }
}

fragment TeamItem on SearchResultItem {
  __typename
  ... on Issue {
    title
    number
    url
    createdAt
    updatedAt
    repository { nameWithOwner }
    author { login }
    assignees(first: 10) { nodes { login } }
  }
  ... on PullRequest {
    title
    number
    url
    createdAt
    updatedAt
    repository { nameWithOwner }
    author { login }
    assignees(first: 10) { nodes { login } }
    reviewDecision
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }
}
"""


class OrganizationNotFound(Exception):
    """Hoot isn't installed on the organization, or the user can't use that installation."""


def searches(organization: str, today: date) -> dict[str, str]:
    """GitHub's search syntax for the four team lists; the keys match ORG_OVERVIEW_QUERY's aliases."""
    stale_before = (today - timedelta(days=STALE_AFTER_DAYS)).isoformat()
    base = f"org:{organization} is:open archived:false"
    return {
        "waiting_for_review": f"{base} is:pr review:required -is:draft sort:created-asc",
        "failing_ci": f"{base} is:pr status:failure sort:updated-desc",
        "unassigned_issues": f"{base} is:issue no:assignee sort:created-asc",
        "stale": f"{base} updated:<{stale_before} sort:updated-asc",
    }


def fetch_org_overview(
    client: httpx.Client, access_token: str, organization: str
) -> schemas.OrgOverview:
    """Load the team view of an organization where the user can use Hoot.

    Raises OrganizationNotFound if Hoot isn't installed there for the user.
    """
    login = _installed_organization(client, access_token, organization)
    queries = searches(login, datetime.now(timezone.utc).date())
    data = github.graphql(client, access_token, ORG_OVERVIEW_QUERY, queries)
    try:
        return build_org_overview(login, queries, data)
    except (KeyError, TypeError, ValidationError) as error:
        raise github.GitHubError("GitHub's organization response has an unexpected shape") from error


def build_org_overview(organization: str, queries: dict[str, str], data: dict) -> schemas.OrgOverview:
    """Turn the GraphQL search results into the team view."""
    return schemas.OrgOverview(
        organization=organization,
        stale_after_days=STALE_AFTER_DAYS,
        **{name: _team_list(data[name], query) for name, query in queries.items()},
    )


def _installed_organization(client: httpx.Client, access_token: str, organization: str) -> str:
    """Return the organization's login as GitHub spells it, or raise OrganizationNotFound."""
    for installation in github.fetch_installations(client, access_token):
        if (
            installation.account_type == "Organization"
            and installation.account.lower() == organization.lower()
        ):
            return installation.account
    raise OrganizationNotFound


def _team_list(search: dict | None, query: str) -> schemas.TeamList:
    """One list with GitHub's total, the loaded items and a link to the full search."""
    return schemas.TeamList(
        total=search["issueCount"] if search else 0,
        items=[_team_item(node) for node in search_nodes(search)],
        search_url=f"https://github.com/search?{urlencode({'q': query, 'type': 'issues'})}",
    )


def _team_item(node: dict) -> schemas.TeamItem:
    """Turn a search result into a team item; deleted accounts have no author."""
    is_pull_request = node["__typename"] == "PullRequest"
    return schemas.TeamItem(
        **item_fields(node),
        created_at=node["createdAt"],
        author=node["author"]["login"] if node["author"] else None,
        assignees=[assignee["login"] for assignee in node["assignees"]["nodes"]],
        ci_status=ci_status(node) if is_pull_request else None,
        review_decision=node["reviewDecision"] if is_pull_request else None,
    )
