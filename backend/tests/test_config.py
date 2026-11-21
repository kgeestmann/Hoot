import pytest

from backend.app.config import MIN_SECRET_KEY_BYTES, read_secret_key


def test_missing_secret_key_is_rejected(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError, match="not set"):
        read_secret_key()


def test_short_secret_key_is_rejected(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "a" * (MIN_SECRET_KEY_BYTES - 1))

    with pytest.raises(RuntimeError, match=f"at least {MIN_SECRET_KEY_BYTES} bytes"):
        read_secret_key()


def test_secret_key_of_minimum_length_is_accepted(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "a" * MIN_SECRET_KEY_BYTES)

    assert read_secret_key() == "a" * MIN_SECRET_KEY_BYTES


def test_secret_key_length_is_measured_in_bytes(monkeypatch):
    # 16 characters, but 32 bytes in UTF-8
    monkeypatch.setenv("SECRET_KEY", "ä" * 16)

    assert read_secret_key() == "ä" * 16
