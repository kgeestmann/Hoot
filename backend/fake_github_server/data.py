"""Made-up GitHub data for the fake GitHub server. Every account name starts with "demo-"."""

from dataclasses import dataclass
from datetime import datetime, timedelta

USER_ID = 1001
LOGIN = "demo-user"
# Accounts where the fake Hoot App is installed, as (login, type, all repositories).
INSTALLATIONS = (
    (LOGIN, "User", True),
    ("demo-labs", "Organization", False),
    ("demo-orbit", "Organization", True),
)

LABEL_COLORS = {
    "bug": "d73a4a",
    "enhancement": "a2eeef",
    "documentation": "0075ca",
    "good first issue": "7057ff",
    "frontend": "fbca04",
    "backend": "0e8a16",
    "security": "b60205",
    "dependencies": "0366d6",
}

REPOSITORIES = (
    "demo-user/hoot-demo",
    "demo-user/dotfiles",
    "demo-labs/rocket",
    "demo-labs/launchpad",
    "demo-orbit/telescope",
)

ISSUE_TITLES = (
    "Login button does nothing on Safari",
    "Dark mode colours are too low in contrast",
    "Crash when the config file is empty",
    "Document the release process",
    "Search ignores archived repositories",
    "Add keyboard shortcuts to the list",
    "Upgrade the test runner",
    "Timezone is wrong in the export",
    "Flaky test in the scheduler",
    "Support SSO sign-in",
    "Rate limit errors are not retried",
    "Sidebar overflows on small screens",
)

LABEL_SETS = (
    ("bug", "frontend"),
    ("enhancement",),
    ("bug", "backend", "security"),
    ("documentation",),
    (),
    ("enhancement", "good first issue"),
    ("dependencies",),
)


@dataclass(frozen=True)
class FakeItem:
    """An open issue or pull request with everything Hoot's searches and fragments ask for."""

    kind: str  # "issue" or "pull_request"
    repository: str
    number: int
    title: str
    author: str
    created: datetime
    updated: datetime
    labels: tuple[str, ...] = ()
    assignees: tuple[str, ...] = ()
    mentions: tuple[str, ...] = ()
    comments: int = 0
    last_comment_by_bot: bool = False
    milestone: str | None = None
    draft: bool = False
    review_decision: str | None = None
    review_requests: tuple[str, ...] = ()
    reviews: tuple[tuple[str, str], ...] = ()  # (login, state)
    ci: str | None = None  # the commit's rollup state: SUCCESS, FAILURE or PENDING
    checks: tuple[tuple[str, str], ...] = ()  # (name, success | failure | pending | neutral)

    @property
    def owner(self) -> str:
        return self.repository.split("/")[0]

    @property
    def url(self) -> str:
        path = "issues" if self.kind == "issue" else "pull"
        return f"https://github.com/{self.repository}/{path}/{self.number}"


def items(now: datetime) -> list[FakeItem]:
    """Every open item the fake user can see, with times relative to `now`."""

    def ago(hours: float) -> datetime:
        return now - timedelta(hours=hours)

    return [
        *_own_pull_requests(ago),
        *_review_requests(ago),
        *_assigned_issues(ago),
        *_mentions(ago),
        *_team_items(ago),
    ]


def _own_pull_requests(ago) -> list[FakeItem]:
    return [
        FakeItem(
            "pull_request", "demo-user/hoot-demo", 41, "Add the overview dashboard", LOGIN,
            ago(30), ago(1), labels=("frontend", "enhancement"), comments=6, milestone="v1.0",
            review_decision="CHANGES_REQUESTED",
            reviews=(("demo-ana", "CHANGES_REQUESTED"), ("demo-ben", "COMMENTED")),
            ci="FAILURE", checks=(("backend", "success"), ("lint", "failure"), ("e2e", "failure")),
        ),
        FakeItem(
            "pull_request", "demo-user/hoot-demo", 44, "Experiment: offline mode", LOGIN,
            ago(5), ago(3), draft=True, review_decision="REVIEW_REQUIRED",
            review_requests=("demo-cleo",),
            ci="PENDING", checks=(("backend", "success"), ("frontend", "pending"), ("docs", "neutral")),
        ),
        FakeItem(
            "pull_request", "demo-labs/rocket", 128, "Retry rate-limited requests with backoff", LOGIN,
            ago(52), ago(6), labels=("backend",), comments=3, milestone="Sprint 12",
            review_decision="APPROVED", reviews=(("demo-cleo", "APPROVED"), ("demo-dan", "APPROVED")),
            ci="SUCCESS", checks=(("build", "success"), ("test", "success")),
        ),
        FakeItem(
            "pull_request", "demo-user/dotfiles", 7, "Switch the shell prompt to a faster theme", LOGIN,
            ago(80), ago(26), review_decision="REVIEW_REQUIRED", review_requests=("demo-ana",),
        ),
        FakeItem(
            "pull_request", "demo-orbit/telescope", 312, "Bump the image library to 4.2", LOGIN,
            ago(51), ago(50), labels=("dependencies",), ci="SUCCESS", checks=(("ci", "success"),),
        ),
    ]


def _review_requests(ago) -> list[FakeItem]:
    titles = (
        "Cache the installation list",
        "Rename the settings page",
        "Add Spanish translations",
        "Fix the flaky upload test",
    )
    authors = ("demo-ana", "demo-ben", "demo-cleo", "demo-dan")
    return [
        FakeItem(
            "pull_request", REPOSITORIES[(index + 2) % len(REPOSITORIES)], 200 + index, title,
            authors[index], ago(20 + index * 15), ago(2 + index * 9),
            labels=("bug",) if index == 3 else (), comments=index,
            review_decision="REVIEW_REQUIRED", review_requests=(LOGIN,),
            ci="SUCCESS", checks=(("ci", "success"),),
        )
        for index, title in enumerate(titles)
    ]


def _assigned_issues(ago) -> list[FakeItem]:
    """62 issues, so the overview's list is cut off at 50 and the list page needs a second page."""
    return [
        FakeItem(
            "issue", REPOSITORIES[index % len(REPOSITORIES)], 10 + index,
            ISSUE_TITLES[(10 + index) % len(ISSUE_TITLES)], "demo-ben",
            ago(100 + index * 13), ago(4 + index * 7),
            labels=LABEL_SETS[(10 + index) % len(LABEL_SETS)], assignees=(LOGIN,),
            comments=(10 + index) % 7, milestone="v1.0" if index % 5 == 0 else None,
        )
        for index in range(62)
    ]


def _mentions(ago) -> list[FakeItem]:
    return [
        FakeItem(
            "issue", "demo-labs/launchpad", 77, "Which region should the staging cluster use?",
            "demo-dan", ago(12), ago(0.5), mentions=(LOGIN,), comments=14,
        ),
        FakeItem(
            "issue", "demo-orbit/telescope", 290, "Roadmap for the next release", "demo-ana",
            ago(400), ago(30), labels=("documentation",), mentions=(LOGIN,), comments=31,
        ),
        FakeItem(
            "issue", "demo-labs/rocket", 131, "Security review of the token handling", "demo-cleo",
            ago(90), ago(75), labels=("security",), mentions=(LOGIN,), comments=2,
            assignees=("demo-cleo",),
        ),
        # The newest comment is a bot's, so Hoot leaves this mention out.
        FakeItem(
            "issue", "demo-labs/launchpad", 80, "Weekly dependency report", "demo-ben",
            ago(48), ago(1), mentions=(LOGIN,), comments=5, last_comment_by_bot=True,
            assignees=("demo-ben",),
        ),
    ]


def _team_items(ago) -> list[FakeItem]:
    """Items only the team views show: by other people, in the two organizations."""
    team = []
    for organization, repository in (("demo-labs", "rocket"), ("demo-orbit", "telescope")):
        repo = f"{organization}/{repository}"
        team += [
            FakeItem(
                "pull_request", repo, 501, "Add a health check endpoint", "demo-ana",
                ago(140), ago(20), review_decision="REVIEW_REQUIRED",
                review_requests=("demo-ben",), ci="SUCCESS", checks=(("ci", "success"),),
            ),
            FakeItem(
                "pull_request", repo, 502, "Move CI to the new runners", "demo-ben",
                ago(60), ago(3), assignees=("demo-cleo",), review_decision="REVIEW_REQUIRED",
                review_requests=("demo-cleo",),
            ),
            FakeItem(
                "pull_request", repo, 510, "Upgrade the database driver", "demo-dan",
                ago(30), ago(1), review_decision="APPROVED", ci="FAILURE",
                checks=(("test", "failure"),),
            ),
            FakeItem(
                "issue", repo, 520, "Error page shows a stack trace", "demo-cleo",
                ago(300), ago(48), labels=("bug",),
            ),
            FakeItem(
                "issue", repo, 521, "Onboarding guide is out of date", "demo-ana",
                ago(900), ago(200), labels=("documentation",),
            ),
            FakeItem(
                "issue", repo, 530, "Investigate memory growth", "demo-ana",
                ago(3000), ago(1700), assignees=("demo-ben",),
            ),
        ]
    return team
