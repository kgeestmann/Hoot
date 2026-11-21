import html
import json
import re

import httpx
import pytest
from cryptography.fernet import Fernet
from dotenv import dotenv_values
from fastapi.testclient import TestClient

from backend import setup_github_app as setup

CREDENTIALS = {
    "id": 1,
    "slug": "hoot-local-abc123",
    "client_id": "Iv23-new-client",
    "client_secret": "new-client-secret",
    "html_url": "https://github.com/apps/hoot-local-abc123",
    "webhook_secret": None,
    "pem": "-----BEGIN RSA PRIVATE KEY-----...",
}


class FakeGitHub:
    """Answers the manifest conversion and records the requests."""

    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.response = httpx.Response(201, json=CREDENTIALS)

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.response


@pytest.fixture
def env_path(tmp_path):
    return tmp_path / ".env"


@pytest.fixture
def github():
    return FakeGitHub()


@pytest.fixture
def setup_run(env_path, github):
    """The setup app with a fake GitHub; `finished` counts calls of on_done."""

    class Run:
        finished = 0

    run = Run()

    def on_done():
        run.finished += 1

    app = setup.create_setup_app(
        env_path,
        lambda: httpx.Client(transport=httpx.MockTransport(github.handle)),
        on_done,
        "Hoot local test",
    )
    run.client = TestClient(app)
    return run


def start_page_form(client):
    """Return the form action and the manifest the start page posts to GitHub."""
    page = client.get("/").text
    action = html.unescape(re.search(r'action="([^"]+)"', page).group(1))
    manifest = json.loads(html.unescape(re.search(r'name="manifest" value="([^"]+)"', page).group(1)))
    return action, manifest


def returned_state(client):
    action, _ = start_page_form(client)
    return httpx.URL(action).params["state"]


# --- Manifest ---


def test_manifest_describes_hoots_app():
    manifest = setup.build_manifest("Hoot local test")

    assert manifest["name"] == "Hoot local test"
    assert manifest["callback_urls"] == ["http://localhost:8000/auth/github/callback"]
    assert manifest["redirect_url"] == "http://localhost:8000/setup/done"
    assert manifest["setup_url"] == "http://localhost:4200/"
    assert manifest["setup_on_update"] is True
    assert manifest["request_oauth_on_install"] is False
    assert manifest["public"] is False
    assert "hook_attributes" not in manifest


def test_manifest_asks_only_for_read_access():
    permissions = setup.build_manifest("Hoot local test")["default_permissions"]

    assert permissions == {
        "issues": "read",
        "pull_requests": "read",
        "checks": "read",
        "statuses": "read",
        "metadata": "read",
    }


def test_start_page_posts_the_manifest_to_github_with_a_state(setup_run):
    action, manifest = start_page_form(setup_run.client)

    assert action.startswith(f"{setup.NEW_APP_URL}?state=")
    assert len(httpx.URL(action).params["state"]) >= 32
    assert manifest == setup.build_manifest("Hoot local test")


# --- Returning from GitHub ---


def test_done_stores_the_credentials_and_generated_keys(setup_run, env_path, github):
    state = returned_state(setup_run.client)

    response = setup_run.client.get(setup.DONE_PATH, params={"code": "the-code", "state": state})

    assert response.status_code == 200
    env = dotenv_values(env_path)
    assert env["GITHUB_CLIENT_ID"] == "Iv23-new-client"
    assert env["GITHUB_CLIENT_SECRET"] == "new-client-secret"
    assert env["GITHUB_APP_SLUG"] == "hoot-local-abc123"
    assert len(env["SECRET_KEY"].encode()) >= 32
    Fernet(env["TOKEN_ENCRYPTION_KEY"])
    assert setup_run.finished == 1


def test_done_exchanges_the_code_with_github(setup_run, github):
    state = returned_state(setup_run.client)

    setup_run.client.get(setup.DONE_PATH, params={"code": "the-code", "state": state})

    [request] = github.requests
    assert request.method == "POST"
    assert str(request.url) == "https://api.github.com/app-manifests/the-code/conversions"


def test_done_keeps_existing_settings(setup_run, env_path):
    env_path.write_text("SECRET_KEY=kept-secret-key-kept-secret-key-kept\nCORS_ORIGINS=http://localhost:4200\n")
    state = returned_state(setup_run.client)

    setup_run.client.get(setup.DONE_PATH, params={"code": "the-code", "state": state})

    env = dotenv_values(env_path)
    assert env["SECRET_KEY"] == "kept-secret-key-kept-secret-key-kept"
    assert env["CORS_ORIGINS"] == "http://localhost:4200"
    assert env["GITHUB_CLIENT_ID"] == "Iv23-new-client"


def test_secrets_are_not_shown_on_the_done_page(setup_run, env_path):
    state = returned_state(setup_run.client)

    response = setup_run.client.get(setup.DONE_PATH, params={"code": "the-code", "state": state})

    env = dotenv_values(env_path)
    for name in ("GITHUB_CLIENT_SECRET", "SECRET_KEY", "TOKEN_ENCRYPTION_KEY"):
        assert env[name] not in response.text


@pytest.mark.parametrize("params", [{"code": "the-code", "state": "forged"}, {"code": "the-code"}, {"state": "x"}])
def test_done_without_the_right_state_or_code_is_rejected(setup_run, env_path, github, params):
    response = setup_run.client.get(setup.DONE_PATH, params=params)

    assert response.status_code == 400
    assert github.requests == []
    assert not env_path.exists()
    assert setup_run.finished == 0


def test_failed_conversion_leaves_env_untouched(setup_run, env_path, github):
    github.response = httpx.Response(422, json={"message": "Validation Failed"})
    state = returned_state(setup_run.client)

    response = setup_run.client.get(setup.DONE_PATH, params={"code": "the-code", "state": state})

    assert response.status_code == 502
    assert not env_path.exists()
    assert setup_run.finished == 0


def test_conversion_without_credentials_is_a_setup_error(github):
    github.response = httpx.Response(201, json={"slug": "hoot-local-abc123"})

    with pytest.raises(setup.SetupError):
        setup.exchange_code(httpx.Client(transport=httpx.MockTransport(github.handle)), "the-code")


# --- Existing configuration ---


def test_is_configured_checks_for_a_client_id(env_path):
    assert not setup.is_configured(env_path)
    env_path.write_text("SECRET_KEY=x\n")
    assert not setup.is_configured(env_path)
    env_path.write_text("GITHUB_CLIENT_ID=Iv23-existing\n")
    assert setup.is_configured(env_path)


def test_add_missing_keys_never_replaces_existing_keys(env_path):
    env_path.write_text("TOKEN_ENCRYPTION_KEY=existing-key\n")

    added = setup.add_missing_keys(env_path)

    assert added == ["SECRET_KEY"]
    assert dotenv_values(env_path)["TOKEN_ENCRYPTION_KEY"] == "existing-key"
