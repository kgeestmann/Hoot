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

from fastapi.testclient import TestClient

from backend.app import models
from backend.app.database import engine
from backend.app.main import app


@pytest.fixture
def client():
    """Test client backed by an empty database."""
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return TestClient(app)


@pytest.fixture
def registered_user(client):
    """Register a user and return the credentials used."""
    credentials = {"email": "user@example.com", "password": "geheim123"}
    response = client.post("/register", json=credentials)
    assert response.status_code == 200
    return credentials
