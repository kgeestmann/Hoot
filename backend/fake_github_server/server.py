"""A stand-in for github.com and api.github.com that answers Hoot's requests from made-up data.

Only for local development; see docs/development.md. Start it with `python -m backend.fake_github_server`.
"""

import base64
import os
import re
import secrets
import time
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlencode

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from . import data
from .nodes import node
from .search import UnsupportedQuery, search

# How long an access token lasts; set it low to watch Hoot refresh tokens.
TOKEN_SECONDS = int(os.getenv("FAKE_GITHUB_TOKEN_SECONDS", "28800"))
REFRESH_TOKEN_SECONDS = 15811200

# Each aliased search in a query, e.g. `pull_requests: search(type: ISSUE, query: $pull_requests, first: 50)`.
SEARCH_FIELD = re.compile(r"(?:(\w+)\s*:\s*)?\bsearch\s*\(([^)]*)\)")


class FakeGitHub:
    """The fake GitHub's state: issued codes and tokens."""

    def __init__(self):
        self.codes: set[str] = set()
        self.access_tokens: dict[str, float] = {}
        self.refresh_tokens: set[str] = set()

    def issue_code(self) -> str:
        code = secrets.token_urlsafe(16)
        self.codes.add(code)
        return code

    def issue_tokens(self) -> dict:
        access_token = f"gho_fake_{secrets.token_urlsafe(16)}"
        refresh_token = f"ghr_fake_{secrets.token_urlsafe(16)}"
        self.access_tokens[access_token] = time.time() + TOKEN_SECONDS
        self.refresh_tokens.add(refresh_token)
        return {
            "access_token": access_token,
            "expires_in": TOKEN_SECONDS,
            "refresh_token": refresh_token,
            "refresh_token_expires_in": REFRESH_TOKEN_SECONDS,
            "token_type": "bearer",
            "scope": "",
        }

    def check_token(self, authorization: str | None) -> None:
        """Raise 401 like GitHub for a missing, unknown or expired access token."""
        token = (authorization or "").removeprefix("Bearer ").strip()
        if self.access_tokens.get(token, 0) < time.time():
            raise HTTPException(status_code=401, detail="Bad credentials")


def create_app() -> FastAPI:
    """The fake GitHub as an ASGI app, with fresh state."""
    app = FastAPI(title="Fake GitHub for Hoot")
    github = FakeGitHub()

    @app.get("/login/oauth/authorize")
    def authorize(redirect_uri: str, state: str):
        """Approve at once and send the browser back to Hoot's callback."""
        query = urlencode({"code": github.issue_code(), "state": state})
        return RedirectResponse(f"{redirect_uri}?{query}", status_code=302)

    @app.post("/login/oauth/access_token")
    async def access_token(request: Request):
        """Exchange a code or a refresh token; errors come as 200 with an "error" field, like GitHub."""
        form = {key: values[0] for key, values in parse_qs((await request.body()).decode()).items()}
        if form.get("grant_type") == "refresh_token":
            refresh_token = form.get("refresh_token")
            if refresh_token not in github.refresh_tokens:
                return {"error": "bad_refresh_token"}
            github.refresh_tokens.discard(refresh_token)
            return github.issue_tokens()
        if form.get("code") not in github.codes:
            return {"error": "bad_verification_code"}
        github.codes.discard(form.get("code"))
        return github.issue_tokens()

    @app.get("/user")
    def user(authorization: str | None = Header(default=None)):
        github.check_token(authorization)
        return {"id": data.USER_ID, "login": data.LOGIN}

    @app.get("/user/installations")
    def installations(authorization: str | None = Header(default=None)):
        github.check_token(authorization)
        return {
            "total_count": len(data.INSTALLATIONS),
            "installations": [
                {
                    "id": index + 1,
                    "account": {"login": login, "type": account_type},
                    "repository_selection": "all" if all_repositories else "selected",
                    "html_url": f"https://github.com/settings/installations/{index + 1}",
                }
                for index, (login, account_type, all_repositories) in enumerate(data.INSTALLATIONS)
            ],
        }

    @app.post("/graphql")
    async def graphql(request: Request, authorization: str | None = Header(default=None)):
        github.check_token(authorization)
        body = await request.json()
        try:
            return {"data": run_searches(body["query"], body.get("variables") or {})}
        except UnsupportedQuery as error:
            return {"errors": [{"message": str(error)}]}

    @app.get("/apps/{slug}/installations/new", response_class=HTMLResponse)
    def install(slug: str):
        accounts = ", ".join(login for login, _, _ in data.INSTALLATIONS)
        return (
            "<!doctype html><title>Fake GitHub</title>"
            f"<p>Fake GitHub: the app is already installed on {accounts}.</p>"
            '<p><a href="http://localhost:4200/">Back to Hoot</a></p>'
        )

    return app


def run_searches(query: str, variables: dict) -> dict:
    """Answer every `search(...)` field of a Hoot query, keyed by its alias."""
    items = data.items(datetime.now(timezone.utc))
    results = {}
    for alias, arguments in SEARCH_FIELD.findall(query):
        search_query = variables[_argument(arguments, "query", variable=True)]
        first = int(_argument(arguments, "first") or 10)
        after_variable = _argument(arguments, "after", variable=True)
        start = _offset(variables.get(after_variable)) if after_variable else 0
        found = search(items, search_query, data.LOGIN)
        page = found[start : start + first]
        end = start + len(page)
        results[alias or "search"] = {
            "issueCount": len(found),
            "pageInfo": {"hasNextPage": end < len(found), "endCursor": _cursor(end) if page else None},
            "nodes": [node(item) for item in page],
        }
    return results


def _argument(arguments: str, name: str, variable: bool = False) -> str | None:
    pattern = rf"\b{name}\s*:\s*\$(\w+)" if variable else rf"\b{name}\s*:\s*(\d+)"
    match = re.search(pattern, arguments)
    return match.group(1) if match else None


def _cursor(offset: int) -> str:
    return base64.b64encode(f"cursor:{offset}".encode()).decode()


def _offset(cursor: str | None) -> int:
    if not cursor:
        return 0
    return int(base64.b64decode(cursor).decode().removeprefix("cursor:"))


app = create_app()
