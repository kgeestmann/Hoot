import os
import tempfile
from pathlib import Path

import pytest

# The app reads its settings and opens the database at import time,
# so the test environment has to be in place before it is imported.
os.environ["SECRET_KEY"] = "test-secret-key-for-the-backend-tests"
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp(), 'test.db').as_posix()}"
# The test client talks plain http://testserver and would not send a Secure cookie back.
os.environ["COOKIE_SECURE"] = "false"
os.environ["GITHUB_CLIENT_ID"] = "test-client-id"
os.environ["GITHUB_CLIENT_SECRET"] = "test-client-secret"
os.environ["GITHUB_APP_SLUG"] = "hoot-test"
os.environ["GITHUB_CALLBACK_URL"] = "http://testserver/auth/github/callback"
os.environ["FRONTEND_URL"] = "http://frontend.test"
os.environ["TOKEN_ENCRYPTION_KEY"] = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="

import httpx
from fastapi.testclient import TestClient

from backend.app import models
from backend.app.crypto import encrypt_token
from backend.app.database import SessionLocal, engine
from backend.app.main import app, get_github_client
from backend.tests.fake_github import FakeGitHub


@pytest.fixture
def client():
    """Test client backed by an empty database."""
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return TestClient(app)


@pytest.fixture
def user(client):
    """A user who signed in with GitHub before; returns its id and login."""
    with SessionLocal() as db:
        stored = models.User(
            github_id=4242,
            login="octocat",
            github_access_token=encrypt_token("gho_stored-token"),
        )
        db.add(stored)
        db.commit()
        return {"id": stored.id, "login": stored.login}


@pytest.fixture
def fake_github(client):
    """Route the backend's GitHub calls to a FakeGitHub and return it."""
    fake = FakeGitHub()

    def mocked_client():
        with httpx.Client(transport=httpx.MockTransport(fake.handle)) as mocked:
            yield mocked

    app.dependency_overrides[get_github_client] = mocked_client
    yield fake
    app.dependency_overrides.pop(get_github_client, None)
