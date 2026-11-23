from datetime import datetime, timedelta, timezone

import pytest

from backend.app import item_states, models
from backend.app.crypto import encrypt_token
from backend.app.database import SessionLocal
from backend.app.main import SESSION_COOKIE_NAME, create_access_token

ISSUE = "https://github.com/octo/hoot/issues/12"
PULL_REQUEST = "https://github.com/octo/hoot/pull/7"


def sign_in_as(client, user_id):
    client.cookies.set(SESSION_COOKIE_NAME, create_access_token(data={"sub": str(user_id)}))


def in_hours(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def stored_urls(client):
    return [state["url"] for state in client.get("/item-states").json()]


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_item_states_require_a_session(client, method):
    response = client.request(method, "/item-states", params={"url": ISSUE}, json={"url": ISSUE, "state": "done"})

    assert response.status_code == 401


def test_nothing_is_done_or_snoozed_at_first(client, user):
    sign_in_as(client, user["id"])

    assert client.get("/item-states").json() == []


def test_marking_as_done_stores_when(client, user):
    sign_in_as(client, user["id"])

    stored = client.put("/item-states", json={"url": ISSUE, "state": "done"}).json()

    assert stored["url"] == ISSUE and stored["snoozed_until"] is None
    done_at = datetime.fromisoformat(stored["done_at"])
    assert abs(datetime.now(timezone.utc) - done_at) < timedelta(seconds=5)
    assert client.get("/item-states").json() == [stored]


def test_snoozing_stores_until_when(client, user):
    sign_in_as(client, user["id"])
    until = in_hours(3)

    stored = client.put("/item-states", json={"url": PULL_REQUEST, "state": "snoozed", "until": until}).json()

    assert stored["done_at"] is None
    assert datetime.fromisoformat(stored["snoozed_until"]) == datetime.fromisoformat(until).replace(microsecond=0)


def test_a_new_state_replaces_the_old_one(client, user):
    sign_in_as(client, user["id"])
    client.put("/item-states", json={"url": ISSUE, "state": "snoozed", "until": in_hours(3)})

    client.put("/item-states", json={"url": ISSUE, "state": "done"})

    [state] = client.get("/item-states").json()
    assert state["done_at"] is not None and state["snoozed_until"] is None


def test_forgetting_shows_the_item_again(client, user):
    sign_in_as(client, user["id"])
    client.put("/item-states", json={"url": ISSUE, "state": "done"})

    first = client.delete("/item-states", params={"url": ISSUE})
    again = client.delete("/item-states", params={"url": ISSUE})

    assert (first.status_code, again.status_code) == (204, 204)
    assert stored_urls(client) == []


@pytest.mark.parametrize(
    "change",
    [
        {"url": "https://example.com/octo/hoot/issues/1", "state": "done"},
        {"url": "https://github.com/octo/hoot/commits/1", "state": "done"},
        {"url": ISSUE, "state": "archived"},
        {"url": ISSUE, "state": "snoozed"},
        {"url": ISSUE, "state": "done", "until": "2030-01-01T09:00:00Z"},
    ],
)
def test_invalid_changes_are_rejected(client, user, change):
    sign_in_as(client, user["id"])

    assert client.put("/item-states", json=change).status_code == 422
    assert stored_urls(client) == []


@pytest.mark.parametrize("hours", [-1, 24 * 400])
def test_a_snooze_must_end_within_the_next_year(client, user, hours):
    sign_in_as(client, user["id"])

    response = client.put("/item-states", json={"url": ISSUE, "state": "snoozed", "until": in_hours(hours)})

    assert response.status_code == 422


def test_a_time_without_a_zone_counts_as_utc(client, user):
    sign_in_as(client, user["id"])
    naive = (datetime.now(timezone.utc) + timedelta(hours=2)).replace(tzinfo=None, microsecond=0)

    stored = client.put("/item-states", json={"url": ISSUE, "state": "snoozed", "until": naive.isoformat()}).json()

    assert datetime.fromisoformat(stored["snoozed_until"]) == naive.replace(tzinfo=timezone.utc)


def test_ended_snoozes_are_not_listed_and_get_pruned(client, user):
    sign_in_as(client, user["id"])
    with SessionLocal() as db:
        db.add(models.ItemState(user_id=user["id"], url=ISSUE, snoozed_until=1))
        db.commit()

    assert stored_urls(client) == []
    client.put("/item-states", json={"url": PULL_REQUEST, "state": "done"})
    with SessionLocal() as db:
        assert [state.url for state in db.query(models.ItemState)] == [PULL_REQUEST]


def test_old_done_states_get_pruned(client, user):
    sign_in_as(client, user["id"])
    long_ago = datetime.now(timezone.utc) - item_states.DONE_KEPT - timedelta(days=1)
    with SessionLocal() as db:
        db.add(models.ItemState(user_id=user["id"], url=ISSUE, done_at=int(long_ago.timestamp())))
        db.commit()

    client.put("/item-states", json={"url": PULL_REQUEST, "state": "done"})

    assert stored_urls(client) == [PULL_REQUEST]


def test_states_belong_to_one_user(client, user):
    with SessionLocal() as db:
        other = models.User(github_id=1, login="hubot", github_access_token=encrypt_token("gho_other"))
        db.add(other)
        db.commit()
        other_id = other.id
    sign_in_as(client, user["id"])
    client.put("/item-states", json={"url": ISSUE, "state": "done"})

    sign_in_as(client, other_id)

    assert stored_urls(client) == []


def test_only_the_newest_states_are_kept_beyond_the_limit(client, user, monkeypatch):
    monkeypatch.setattr(item_states, "MAX_STATES", 2)
    sign_in_as(client, user["id"])
    urls = [f"https://github.com/octo/hoot/issues/{number}" for number in (1, 2, 3)]

    for url in urls:
        client.put("/item-states", json={"url": url, "state": "done"})

    assert sorted(stored_urls(client)) == urls[1:]


@pytest.mark.parametrize("url", ["https://example.com/octo/hoot/issues/1", "not a url"])
def test_forgetting_needs_a_github_item_url(client, user, url):
    sign_in_as(client, user["id"])

    assert client.delete("/item-states", params={"url": url}).status_code == 422


def test_replacing_a_state_at_the_limit_keeps_the_others(client, user, monkeypatch):
    monkeypatch.setattr(item_states, "MAX_STATES", 2)
    sign_in_as(client, user["id"])
    first, second = (f"https://github.com/octo/hoot/issues/{number}" for number in (1, 2))
    client.put("/item-states", json={"url": first, "state": "done"})
    client.put("/item-states", json={"url": second, "state": "done"})

    client.put("/item-states", json={"url": first, "state": "snoozed", "until": in_hours(3)})

    assert sorted(stored_urls(client)) == [first, second]


def test_forgetting_also_prunes(client, user):
    sign_in_as(client, user["id"])
    with SessionLocal() as db:
        db.add(models.ItemState(user_id=user["id"], url=ISSUE, snoozed_until=1))
        db.commit()

    client.delete("/item-states", params={"url": PULL_REQUEST})

    with SessionLocal() as db:
        assert db.query(models.ItemState).count() == 0


def test_an_item_whose_snooze_ended_can_be_marked_again(client, user):
    sign_in_as(client, user["id"])
    with SessionLocal() as db:
        db.add(models.ItemState(user_id=user["id"], url=ISSUE, snoozed_until=1))
        db.commit()

    response = client.put("/item-states", json={"url": ISSUE, "state": "done"})

    assert response.status_code == 200
    [state] = client.get("/item-states").json()
    assert state["url"] == ISSUE and state["done_at"] is not None
