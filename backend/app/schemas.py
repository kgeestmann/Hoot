from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

class UserResponse(BaseModel):
    id: int
    login: str

    class Config:
        from_attributes = True


class OverviewItem(BaseModel):
    """An issue or pull request on the overview."""

    kind: Literal["issue", "pull_request"]
    title: str
    repository: str  # owner/name
    number: int
    url: str
    updated_at: datetime


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
