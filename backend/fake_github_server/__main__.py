"""Run the fake GitHub and a Hoot backend that uses it, from the repo root:

    python -m backend.fake_github_server

The fake GitHub listens on localhost:8100, the backend on localhost:8000 (with reload), so
`npm start` in frontend/ works as usual. The backend gets its own database, emptied on every
start, and reads .env for anything not set here.
"""

import os
import secrets
import signal
import socket
import subprocess
import sys
from pathlib import Path

import uvicorn
from cryptography.fernet import Fernet
from dotenv import dotenv_values

FAKE_GITHUB_PORT = 8100
BACKEND_PORT = 8000
REPO = Path(__file__).resolve().parents[2]
DATABASE = REPO / "backend" / "hoot-fake.db"


def backend_environment() -> dict[str, str]:
    """The backend's settings: pointed at the fake GitHub, with any missing secret filled in."""
    fake_github = f"http://localhost:{FAKE_GITHUB_PORT}"
    configured = {**dotenv_values(REPO / ".env"), **os.environ}
    defaults = {
        "SECRET_KEY": secrets.token_urlsafe(32),
        "TOKEN_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "GITHUB_CLIENT_ID": "fake-client-id",
        "GITHUB_CLIENT_SECRET": "fake-client-secret",
        "GITHUB_APP_SLUG": "hoot-fake",
    }
    environment = {**defaults, **{key: value for key, value in configured.items() if value}}
    environment.update(
        GITHUB_URL=fake_github,
        GITHUB_API_URL=fake_github,
        GITHUB_CALLBACK_URL=f"http://localhost:{BACKEND_PORT}/auth/github/callback",
        DATABASE_URL=f"sqlite:///{DATABASE.as_posix()}",
        ROOT_PATH="",
    )
    return environment


def port_in_use(port: int) -> bool:
    """Tell whether something already listens on localhost:port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        return probe.connect_ex(("localhost", port)) == 0


def start_backend() -> subprocess.Popen:
    """Start the Hoot backend with reload, in its own process group so it can be stopped as a whole."""
    command = [
        sys.executable, "-m", "uvicorn", "backend.app.main:app",
        "--port", str(BACKEND_PORT), "--reload", "--reload-dir", str(REPO / "backend" / "app"),
    ]
    if os.name == "nt":
        return subprocess.Popen(command, cwd=REPO, env=backend_environment())
    return subprocess.Popen(command, cwd=REPO, env=backend_environment(), start_new_session=True)


def stop(process: subprocess.Popen) -> None:
    """Stop a process and everything it started, such as the worker of uvicorn's reloader."""
    if process.poll() is None:
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], capture_output=True)
        else:
            os.killpg(process.pid, signal.SIGTERM)
    process.wait()


def main() -> None:
    """Start the backend in a child process and the fake GitHub in this one; Ctrl+C stops both."""
    # On Windows a second server can start on a port in use, and requests then reach either one.
    busy = [port for port in (BACKEND_PORT, FAKE_GITHUB_PORT) if port_in_use(port)]
    if busy:
        sys.exit(f"Port {', '.join(map(str, busy))} is in use. Stop the other server first (e.g. your normal backend).")
    DATABASE.unlink(missing_ok=True)
    backend = start_backend()
    print(f"Fake GitHub on http://localhost:{FAKE_GITHUB_PORT}, Hoot backend on http://localhost:{BACKEND_PORT}")
    print("Start the frontend with npm start in frontend/ and sign in: the fake GitHub approves at once.")
    try:
        uvicorn.run("backend.fake_github_server.server:app", host="localhost", port=FAKE_GITHUB_PORT)
    finally:
        stop(backend)


if __name__ == "__main__":
    main()
