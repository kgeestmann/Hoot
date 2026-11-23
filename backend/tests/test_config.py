import pytest

from backend.app.config import MIN_SECRET_KEY_BYTES, read_bool, read_root_path, read_secret_key


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


def test_bool_setting_falls_back_to_the_default(monkeypatch):
    monkeypatch.delenv("COOKIE_SECURE", raising=False)

    assert read_bool("COOKIE_SECURE", default=True) is True


@pytest.mark.parametrize(("value", "expected"), [("true", True), ("FALSE", False)])
def test_bool_setting_accepts_true_and_false(monkeypatch, value, expected):
    monkeypatch.setenv("COOKIE_SECURE", value)

    assert read_bool("COOKIE_SECURE", default=True) is expected


def test_bool_setting_rejects_other_values(monkeypatch):
    monkeypatch.setenv("COOKIE_SECURE", "yes")

    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        read_bool("COOKIE_SECURE", default=True)


def test_root_path_is_empty_by_default(monkeypatch):
    monkeypatch.delenv("ROOT_PATH", raising=False)

    assert read_root_path() == ""


def test_root_path_drops_a_trailing_slash(monkeypatch):
    monkeypatch.setenv("ROOT_PATH", "/api/")

    assert read_root_path() == "/api"


def test_root_path_without_leading_slash_is_rejected(monkeypatch):
    monkeypatch.setenv("ROOT_PATH", "api")

    with pytest.raises(RuntimeError, match="ROOT_PATH"):
        read_root_path()
