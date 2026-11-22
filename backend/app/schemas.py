from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    login: str


class Label(BaseModel):
    """A GitHub label with its colour as six hex digits without "#", e.g. "d73a4a"."""

    name: str
    color: str = Field(pattern=r"^[0-9a-fA-F]{6}$")


class OverviewItem(BaseModel):
    """An issue or pull request on the overview."""

    kind: Literal["issue", "pull_request"]
    title: str
    repository: str  # owner/name
    number: int
    url: str
    updated_at: datetime
    labels: list[Label]


class PullRequestItem(OverviewItem):
    """One of the user's own pull requests, with its CI status and review state."""

    # GitHub's values: SUCCESS, FAILURE, PENDING, ERROR or EXPECTED; None without checks.
    ci_status: str | None
    # GitHub's values: APPROVED, CHANGES_REQUESTED or REVIEW_REQUIRED; None if no review is required.
    review_decision: str | None


class Overview(BaseModel):
    """Everything on GitHub that is waiting on the user, newest activity first."""

    assigned_issues: list[OverviewItem]
    pull_requests: list[PullRequestItem]
    review_requests: list[OverviewItem]
    mentions: list[OverviewItem]


class Installation(BaseModel):
    """An account (user or organization) where Hoot is installed."""

    model_config = ConfigDict(from_attributes=True)

    account: str
    # GitHub's account type: "User" or "Organization".
    account_type: str
    all_repositories: bool
    settings_url: str


class GitHubAccess(BaseModel):
    """Where Hoot can see the user's repositories, and the page to install it on more accounts."""

    install_url: str
    installations: list[Installation]


# "owner" or "owner/repository" as GitHub allows them, compared in lowercase.
Scope = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=140,
        pattern=r"^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:/[A-Za-z0-9._-]+)?$",
    ),
]


class OverviewFilters(BaseModel):
    """What the user hid from the overview; everything else is shown."""

    hidden: list[Scope] = Field(max_length=500)

    @field_validator("hidden")
    @classmethod
    def sorted_without_duplicates(cls, hidden: list[str]) -> list[str]:
        """Store each scope once, in a stable order."""
        return sorted(set(hidden))


class TeamItem(OverviewItem):
    """An issue or pull request in an organization's team view."""

    created_at: datetime
    # None for deleted accounts.
    author: str | None
    assignees: list[str]
    # Only for pull requests; same values as in PullRequestItem.
    ci_status: str | None
    review_decision: str | None


class TeamList(BaseModel):
    """One list of the team view: GitHub's total, up to 20 items and the full search on GitHub."""

    total: int
    items: list[TeamItem]
    search_url: str


class OrgOverview(BaseModel):
    """What needs the team's attention in an organization. Deliberately no statistics per person."""

    organization: str
    stale_after_days: int
    waiting_for_review: TeamList
    failing_ci: TeamList
    unassigned_issues: TeamList
    stale: TeamList
