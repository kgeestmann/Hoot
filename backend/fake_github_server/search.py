"""GitHub's issue search syntax, as far as Hoot's queries use it, evaluated on the fake data."""

from datetime import date

from .data import FakeItem


class UnsupportedQuery(ValueError):
    """The search uses a qualifier the fake GitHub doesn't know; extend `_matches`."""


def search(items: list[FakeItem], query: str, login: str) -> list[FakeItem]:
    """Return the items matching every term of `query`, in its `sort:` order (newest update first)."""
    order = "updated-desc"
    found = items
    for term in query.split():
        if term.startswith("sort:"):
            order = term.removeprefix("sort:")
        else:
            found = [item for item in found if _matches(item, term, login)]
    return _sorted(found, order)


def _matches(item: FakeItem, term: str, login: str) -> bool:
    negated = term.startswith("-")
    qualifier, _, value = term.removeprefix("-").partition(":")
    if value == "@me":
        value = login
    matched = _qualifier_matches(item, qualifier, value, term)
    return not matched if negated else matched


def _qualifier_matches(item: FakeItem, qualifier: str, value: str, term: str) -> bool:
    if qualifier == "is" and value in ("open", "issue", "pr", "draft"):
        return {
            "open": True,
            "issue": item.kind == "issue",
            "pr": item.kind == "pull_request",
            "draft": item.draft,
        }[value]
    if qualifier == "archived" and value == "false":
        return True
    if qualifier == "assignee":
        return value in item.assignees
    if qualifier == "author":
        return item.author == value
    if qualifier == "review-requested":
        return value in item.review_requests
    if qualifier == "mentions":
        return value in item.mentions
    if qualifier == "org":
        return item.owner.lower() == value.lower()
    if qualifier == "review" and value == "required":
        return item.kind == "pull_request" and item.review_decision == "REVIEW_REQUIRED"
    if qualifier == "status" and value in ("success", "failure", "pending"):
        return item.ci == value.upper()
    if qualifier == "no" and value == "assignee":
        return not item.assignees
    if qualifier == "updated" and value.startswith("<"):
        return item.updated.date() < date.fromisoformat(value[1:])
    raise UnsupportedQuery(f"The fake GitHub doesn't support the search term {term!r}")


def _sorted(items: list[FakeItem], order: str) -> list[FakeItem]:
    field, _, direction = order.partition("-")
    if field not in ("updated", "created") or direction not in ("asc", "desc"):
        raise UnsupportedQuery(f"The fake GitHub doesn't support sort:{order}")
    return sorted(items, key=lambda item: getattr(item, field), reverse=direction == "desc")
