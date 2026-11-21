import base64
import hashlib
import logging
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from .config import (
    GITHUB_APP_SLUG,
    GITHUB_CALLBACK_URL,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
)

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"
USER_URL = "https://api.github.com/user"
GRAPHQL_URL = "https://api.github.com/graphql"
INSTALLATIONS_URL = "https://api.github.com/user/installations"
INSTALL_URL = f"https://github.com/apps/{GITHUB_APP_SLUG}/installations/new"
API_HEADERS = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


class GitHubError(Exception):
    """GitHub rejected a request or answered with something unexpected."""


class GitHubTokenRejected(GitHubError):
    """GitHub rejected a token or code: expired, revoked or invalid."""


@dataclass(frozen=True)
class GitHubTokens:
    """User tokens from the code exchange; the expiry fields are seconds from now."""

    access_token: str
    access_token_expires_in: int | None
    refresh_token: str | None
    refresh_token_expires_in: int | None


@dataclass(frozen=True)
class GitHubUser:
    id: int
    login: str


@dataclass(frozen=True)
class Installation:
    """An account (user or organization) where the user can use Hoot."""

    account: str
    account_type: str
    all_repositories: bool
    settings_url: str


def code_challenge(verifier: str) -> str:
    """Return the PKCE S256 code challenge for a code verifier."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def authorize_url(state: str, verifier: str) -> str:
    """Return the GitHub page that asks the user to authorize Hoot."""
    query = urlencode(
        {
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": GITHUB_CALLBACK_URL,
            "state": state,
            "code_challenge": code_challenge(verifier),
            "code_challenge_method": "S256",
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def exchange_code(client: httpx.Client, code: str, verifier: str) -> GitHubTokens:
    """Trade the authorization code for the user's access and refresh tokens."""
    return _request_tokens(
        client,
        {
            "code": code,
            "redirect_uri": GITHUB_CALLBACK_URL,
            "code_verifier": verifier,
        },
    )


def refresh_tokens(client: httpx.Client, refresh_token: str) -> GitHubTokens:
    """Trade a refresh token for a new pair of access and refresh tokens."""
    return _request_tokens(
        client, {"grant_type": "refresh_token", "refresh_token": refresh_token}
    )


def _request_tokens(client: httpx.Client, grant: dict) -> GitHubTokens:
    """Ask GitHub's token endpoint for user tokens with the given grant."""
    body = _request_json(
        client,
        "POST",
        TOKEN_URL,
        headers={"Accept": "application/json"},
        data={"client_id": GITHUB_CLIENT_ID, "client_secret": GITHUB_CLIENT_SECRET, **grant},
    )
    # GitHub reports an invalid or expired code or refresh token as 200 with an "error" field.
    if not isinstance(body.get("access_token"), str):
        raise GitHubTokenRejected(f"Token request failed: {body.get('error', 'no access_token')}")
    return GitHubTokens(
        access_token=body["access_token"],
        access_token_expires_in=body.get("expires_in"),
        refresh_token=body.get("refresh_token"),
        refresh_token_expires_in=body.get("refresh_token_expires_in"),
    )


def fetch_user(client: httpx.Client, access_token: str) -> GitHubUser:
    """Load the GitHub account the access token belongs to."""
    body = _request_json(
        client,
        "GET",
        USER_URL,
        headers={**API_HEADERS, "Authorization": f"Bearer {access_token}"},
    )
    if not isinstance(body.get("id"), int) or not isinstance(body.get("login"), str):
        raise GitHubError("GitHub user response is missing id or login")
    return GitHubUser(id=body["id"], login=body["login"])


def fetch_installations(client: httpx.Client, access_token: str) -> list[Installation]:
    """List the accounts where Hoot is installed and the user can access it.

    Enterprise installations have no account login and are left out.
    """
    body = _request_json(
        client,
        "GET",
        INSTALLATIONS_URL,
        headers={**API_HEADERS, "Authorization": f"Bearer {access_token}"},
        params={"per_page": 100},
    )
    try:
        return [
            Installation(
                account=installation["account"]["login"],
                account_type=installation["account"]["type"],
                all_repositories=installation["repository_selection"] == "all",
                settings_url=installation["html_url"],
            )
            for installation in body["installations"]
            if "login" in installation["account"]
        ]
    except (KeyError, TypeError) as error:
        raise GitHubError("GitHub's installations response has an unexpected shape") from error


def graphql(client: httpx.Client, access_token: str, query: str, variables: dict) -> dict:
    """Run a GraphQL query as the user and return its data.

    Partial errors (e.g. one repository the token may not read) are logged, and the
    data GitHub could load is returned.
    """
    body = _request_json(
        client,
        "POST",
        GRAPHQL_URL,
        headers={**API_HEADERS, "Authorization": f"Bearer {access_token}"},
        json={"query": query, "variables": variables},
    )
    errors = body.get("errors") or []
    if not isinstance(body.get("data"), dict):
        raise GitHubError(f"GraphQL query failed: {_error_messages(errors)}")
    if errors:
        logger.warning("GraphQL query returned partial errors: %s", _error_messages(errors))
    return body["data"]


def _error_messages(errors: list) -> str:
    """Join the messages of GraphQL errors for a log line."""
    messages = [str(error.get("message")) for error in errors if isinstance(error, dict)]
    return "; ".join(messages) or "no data"


def _request_json(client: httpx.Client, method: str, url: str, **kwargs) -> dict:
    """Send a request to GitHub and return the JSON object it answers with."""
    try:
        response = client.request(method, url, **kwargs)
    except httpx.HTTPError as error:
        raise GitHubError(f"Request to {url} failed: {type(error).__name__}") from error
    if response.status_code == 401:
        raise GitHubTokenRejected(f"{url} answered 401")
    if response.status_code != 200:
        raise GitHubError(f"{url} answered {response.status_code}")
    try:
        body = response.json()
    except ValueError as error:
        raise GitHubError(f"{url} answered with invalid JSON") from error
    if not isinstance(body, dict):
        raise GitHubError(f"{url} answered with unexpected JSON")
    return body
