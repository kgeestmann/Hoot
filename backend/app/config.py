import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# RFC 7518 §3.2: an HS256 key must be at least as long as the hash output.
MIN_SECRET_KEY_BYTES = 32


def read_required(name: str) -> str:
    """Return a required environment variable, or raise if it is missing or empty."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. For a local setup run python backend/setup_github_app.py, "
            "or add it to .env (see .env.example and docs/configuration.md)."
        )
    return value


def read_secret_key() -> str:
    """Return SECRET_KEY from the environment, or raise if it is missing or too short."""
    secret_key = read_required("SECRET_KEY")
    if len(secret_key.encode("utf-8")) < MIN_SECRET_KEY_BYTES:
        raise RuntimeError(
            f"SECRET_KEY must be at least {MIN_SECRET_KEY_BYTES} bytes. "
            "Create one as described in docs/configuration.md."
        )
    return secret_key


SECRET_KEY = read_secret_key()


def read_bool(name: str, default: bool) -> bool:
    """Return the environment variable as a bool; only "true" and "false" are accepted."""
    value = os.getenv(name)
    if value is None:
        return default
    if value.lower() not in ("true", "false"):
        raise RuntimeError(f'{name} must be "true" or "false", got "{value}".')
    return value.lower() == "true"


def read_root_path() -> str:
    """Return ROOT_PATH without a trailing slash; empty, or a path starting with "/"."""
    root_path = os.getenv("ROOT_PATH", "").rstrip("/")
    if root_path and not root_path.startswith("/"):
        raise RuntimeError(f'ROOT_PATH must start with "/", got "{root_path}".')
    return root_path


ALGORITHM = os.getenv("ALGORITHM", "HS256")
# A session ends after this many minutes without a request; requests keep renewing it.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
# However active, a session ends this many days after signing in, so a stolen cookie can't be
# kept alive forever.
SESSION_MAX_DAYS = int(os.getenv("SESSION_MAX_DAYS", "7"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200").split(",")
# Chrome, Edge and Firefox accept Secure cookies on http://localhost, so this stays on in
# development too. Safari doesn't; set COOKIE_SECURE=false there.
COOKIE_SECURE = read_bool("COOKIE_SECURE", default=True)

# GitHub App credentials and URLs for the OAuth sign-in.
GITHUB_CLIENT_ID = read_required("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = read_required("GITHUB_CLIENT_SECRET")
# The app's URL name (github.com/apps/<slug>), for links to its install page.
GITHUB_APP_SLUG = read_required("GITHUB_APP_SLUG")
# Where GitHub lives. Only changed to run against the fake GitHub (python -m backend.fake_github_server).
DEFAULT_GITHUB_URL = "https://github.com"
DEFAULT_GITHUB_API_URL = "https://api.github.com"
GITHUB_URL = os.getenv("GITHUB_URL", DEFAULT_GITHUB_URL).rstrip("/")
GITHUB_API_URL = os.getenv("GITHUB_API_URL", DEFAULT_GITHUB_API_URL).rstrip("/")
GITHUB_CALLBACK_URL = os.getenv("GITHUB_CALLBACK_URL", "http://localhost:8000/auth/github/callback")
# Where the browser lands after the sign-in. Fixed, so the callback can't be used as an open redirect.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200").rstrip("/")
# Fernet key for the GitHub tokens in the database; deliberately separate from SECRET_KEY.
TOKEN_ENCRYPTION_KEY = read_required("TOKEN_ENCRYPTION_KEY")

# Path prefix under which a reverse proxy serves the backend (e.g. "/api" in the Docker setup),
# with the proxy stripping it from requests. Empty when the backend is served at the root.
ROOT_PATH = read_root_path()

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "hoot.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}")
