import base64
import hashlib
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from .config import GITHUB_CALLBACK_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"
USER_URL = "https://api.github.com/user"


class GitHubError(Exception):
    """GitHub rejected a request or answered with something unexpected."""


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
    body = _request_json(
        client,
        "POST",
        TOKEN_URL,
        headers={"Accept": "application/json"},
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": GITHUB_CALLBACK_URL,
            "code_verifier": verifier,
        },
    )
    # GitHub reports an invalid or expired code as 200 with an "error" field.
    if not isinstance(body.get("access_token"), str):
        raise GitHubError(f"Token exchange failed: {body.get('error', 'no access_token')}")
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
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    if not isinstance(body.get("id"), int) or not isinstance(body.get("login"), str):
        raise GitHubError("GitHub user response is missing id or login")
    return GitHubUser(id=body["id"], login=body["login"])


def _request_json(client: httpx.Client, method: str, url: str, **kwargs) -> dict:
    """Send a request to GitHub and return the JSON object it answers with."""
    try:
        response = client.request(method, url, **kwargs)
    except httpx.HTTPError as error:
        raise GitHubError(f"Request to {url} failed: {type(error).__name__}") from error
    if response.status_code != 200:
        raise GitHubError(f"{url} answered {response.status_code}")
    try:
        body = response.json()
    except ValueError as error:
        raise GitHubError(f"{url} answered with invalid JSON") from error
    if not isinstance(body, dict):
        raise GitHubError(f"{url} answered with unexpected JSON")
    return body
