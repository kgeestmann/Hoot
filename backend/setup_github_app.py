"""One-time setup for a local Hoot: register its GitHub App from a manifest and fill in .env.

Run from anywhere with the backend stopped:  python backend/setup_github_app.py
"""

import html
import json
import secrets
import socket
import sys
import webbrowser
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import httpx
import uvicorn
from cryptography.fernet import Fernet
from dotenv import dotenv_values, set_key
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

# The setup page runs where the backend will run, so GitHub's redirects land on the same URLs.
SETUP_HOST = "localhost"
SETUP_PORT = 8000
BACKEND_URL = f"http://{SETUP_HOST}:{SETUP_PORT}"
FRONTEND_URL = "http://localhost:4200"
DONE_PATH = "/setup/done"

NEW_APP_URL = "https://github.com/settings/apps/new"
CONVERSION_URL = "https://api.github.com/app-manifests/{code}/conversions"


class SetupError(Exception):
    """GitHub did not hand over the new app's credentials."""


@dataclass(frozen=True)
class AppCredentials:
    client_id: str
    client_secret: str
    slug: str
    settings_url: str


def build_manifest(name: str) -> dict:
    """Describe Hoot's GitHub App: read-only access, sign-in callback, no webhook."""
    return {
        "name": name,
        "url": FRONTEND_URL,
        "description": "Shows everything that is waiting on you on GitHub.",
        "redirect_url": f"{BACKEND_URL}{DONE_PATH}",
        "callback_urls": [f"{BACKEND_URL}/auth/github/callback"],
        "setup_url": f"{FRONTEND_URL}/",
        "setup_on_update": True,
        # Hoot's callback rejects sign-ins it didn't start (no state), see README.
        "request_oauth_on_install": False,
        "public": False,
        "default_permissions": {
            "issues": "read",
            "pull_requests": "read",
            "checks": "read",
            "statuses": "read",
            "metadata": "read",
        },
    }


def exchange_code(client: httpx.Client, code: str) -> AppCredentials:
    """Trade the code from GitHub's redirect for the new app's credentials."""
    try:
        response = client.post(
            CONVERSION_URL.format(code=code),
            headers={"Accept": "application/vnd.github+json"},
        )
    except httpx.HTTPError as error:
        raise SetupError(f"GitHub could not be reached: {type(error).__name__}") from error
    if response.status_code != 201:
        raise SetupError(f"GitHub answered {response.status_code}")
    try:
        body = response.json()
        return AppCredentials(
            client_id=body["client_id"],
            client_secret=body["client_secret"],
            slug=body["slug"],
            settings_url=body["html_url"],
        )
    except (ValueError, KeyError, TypeError) as error:
        raise SetupError("GitHub's answer is missing the app's credentials") from error


def is_configured(env_path: Path) -> bool:
    """Tell whether .env already names a GitHub App."""
    return bool(env_path.exists() and dotenv_values(env_path).get("GITHUB_CLIENT_ID"))


def add_missing_keys(env_path: Path) -> list[str]:
    """Generate SECRET_KEY and TOKEN_ENCRYPTION_KEY if .env lacks them; return the names added.

    Existing keys are kept: a new TOKEN_ENCRYPTION_KEY would make stored GitHub tokens unreadable.
    """
    env_path.touch(mode=0o600, exist_ok=True)
    existing = dotenv_values(env_path)
    generated = {
        "SECRET_KEY": lambda: secrets.token_urlsafe(32),
        "TOKEN_ENCRYPTION_KEY": lambda: Fernet.generate_key().decode("ascii"),
    }
    added = []
    for name, generate in generated.items():
        if not existing.get(name):
            _set(env_path, name, generate())
            added.append(name)
    return added


def save_credentials(env_path: Path, credentials: AppCredentials) -> None:
    """Write the app's credentials to .env, plus any missing generated keys."""
    add_missing_keys(env_path)
    _set(env_path, "GITHUB_CLIENT_ID", credentials.client_id)
    _set(env_path, "GITHUB_CLIENT_SECRET", credentials.client_secret)
    _set(env_path, "GITHUB_APP_SLUG", credentials.slug)


def _set(env_path: Path, name: str, value: str) -> None:
    set_key(env_path, name, value, quote_mode="never")


def create_setup_app(
    env_path: Path,
    get_client: Callable[[], httpx.Client],
    on_done: Callable[[], None],
    app_name: str,
) -> FastAPI:
    """The two pages of the setup: send the manifest to GitHub, then store what comes back."""
    app = FastAPI()
    state = secrets.token_urlsafe(32)

    @app.get("/", response_class=HTMLResponse)
    def start():
        """Post the manifest to GitHub as soon as the page loads."""
        manifest = html.escape(json.dumps(build_manifest(app_name)), quote=True)
        return _page(
            "Create Hoot's GitHub App",
            f"""
            <p>GitHub will show the app's settings. Check the name and click <b>Create GitHub App</b>.</p>
            <form id="manifest-form" action="{NEW_APP_URL}?state={state}" method="post">
              <input type="hidden" name="manifest" value="{manifest}">
              <button type="submit">Continue to GitHub</button>
            </form>
            <script>document.getElementById("manifest-form").submit();</script>
            """,
        )

    @app.get(DONE_PATH, response_class=HTMLResponse)
    def done(code: str | None = None, returned_state: str | None = Query(None, alias="state")):
        """Exchange GitHub's code for the credentials and write them to .env."""
        if code is None or returned_state is None or not secrets.compare_digest(returned_state, state):
            return _page("Setup failed", "<p>This link did not come from this setup. Start it again.</p>", 400)
        try:
            with get_client() as client:
                credentials = exchange_code(client, code)
        except SetupError as error:
            return _page("Setup failed", f"<p>{html.escape(str(error))}. Start the setup again.</p>", 502)
        save_credentials(env_path, credentials)
        on_done()
        return _page(
            "Hoot's GitHub App is ready",
            f"""
            <p>The credentials are in <code>.env</code>. You can close this tab.</p>
            <p>Start the backend with <code>python backend/app/main.py</code> and the frontend with
            <code>npm start</code>, then open <a href="{FRONTEND_URL}">{FRONTEND_URL}</a> and sign in.</p>
            <p>App settings on GitHub: <a href="{html.escape(credentials.settings_url)}">{html.escape(credentials.settings_url)}</a></p>
            """,
        )

    return app


def _page(title: str, body: str, status_code: int = 200) -> HTMLResponse:
    """A plain HTML page; the setup runs before the Angular frontend is configured."""
    return HTMLResponse(
        f"<!doctype html><title>{title}</title><main style='font-family:sans-serif;max-width:40rem'>"
        f"<h1>{title}</h1>{body}</main>",
        status_code=status_code,
    )


def port_is_free(host: str, port: int) -> bool:
    """Tell whether nothing (e.g. a running backend) listens on the port yet."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        return probe.connect_ex((host, port)) != 0


def main() -> int:
    """Run the setup in the browser and return the exit code."""
    if is_configured(ENV_PATH):
        added = add_missing_keys(ENV_PATH)
        print(f"{ENV_PATH} already has a GitHub App (GITHUB_CLIENT_ID).", end=" ")
        print(f"Added {', '.join(added)}." if added else "Nothing to do.")
        print("To create a new app, remove the GITHUB_* lines from .env and run this again.")
        return 0
    if not port_is_free(SETUP_HOST, SETUP_PORT):
        print(f"Port {SETUP_PORT} is in use. Stop the backend and run this again.")
        return 1

    def finish() -> None:
        server.should_exit = True

    app = create_setup_app(
        ENV_PATH, lambda: httpx.Client(timeout=10), finish, f"Hoot local {secrets.token_hex(3)}"
    )
    server = uvicorn.Server(
        uvicorn.Config(app, host=SETUP_HOST, port=SETUP_PORT, log_level="warning")
    )
    print(f"Opening {BACKEND_URL} to create the GitHub App on GitHub (Ctrl+C to cancel) ...")
    webbrowser.open(BACKEND_URL)
    server.run()
    if not is_configured(ENV_PATH):
        print("Setup cancelled; .env is unchanged.")
        return 1
    print(f"Done: {ENV_PATH} has the app's credentials. Start the backend with python backend/app/main.py.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
