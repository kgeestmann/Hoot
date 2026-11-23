"""One of the overview's lists on its own page: every item, page by page, in a chosen order."""

from typing import Literal

import httpx
from pydantic import ValidationError

from . import github, schemas
from .overview import (
    ITEM_FRAGMENT,
    LIST_SEARCHES,
    github_search_url,
    latest_activity_by_bot,
    overview_item,
    pull_request_item,
    search_nodes,
)

ListName = Literal["pull_requests", "review_requests", "assigned_issues", "mentions"]
ListSort = Literal["updated", "oldest", "created"]

SORTS: dict[str, str] = {
    "updated": "sort:updated-desc",
    "oldest": "sort:created-asc",
    "created": "sort:created-desc",
}

LIST_QUERY = (
    """
query List($query: String!, $after: String) {
  search(type: ISSUE, query: $query, first: 50, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { ...Item }
  }
}
"""
    + ITEM_FRAGMENT
)


def list_query(name: ListName, sort: ListSort) -> str:
    """GitHub's search syntax for one list in the given order."""
    return f"{LIST_SEARCHES[name]} {SORTS[sort]}"


def fetch_list(
    client: httpx.Client, access_token: str, name: ListName, sort: ListSort, after: str | None
) -> schemas.ListPage:
    """Load one page (50 items) of a list; `after` is the previous page's `end_cursor`."""
    query = list_query(name, sort)
    data = github.graphql(client, access_token, LIST_QUERY, {"query": query, "after": after})
    try:
        return build_list_page(name, query, data["search"])
    except (KeyError, TypeError, ValidationError) as error:
        raise github.GitHubError("GitHub's list response has an unexpected shape") from error


def build_list_page(name: ListName, query: str, search: dict) -> schemas.ListPage:
    """Turn one page of search results into items, like the overview does for that list."""
    nodes = search_nodes(search)
    if name == "mentions":
        nodes = [node for node in nodes if not latest_activity_by_bot(node)]
    to_item = pull_request_item if name == "pull_requests" else overview_item
    return schemas.ListPage(
        items=[to_item(node) for node in nodes],
        total=search["issueCount"],
        has_more=search["pageInfo"]["hasNextPage"],
        end_cursor=search["pageInfo"]["endCursor"],
        search_url=github_search_url(query),
    )
