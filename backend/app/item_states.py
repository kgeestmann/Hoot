"""The items a user marked as done or snoozed, stored per user and pruned when they no longer apply."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from . import models

# Snoozes reach at most this far ahead.
MAX_SNOOZE = timedelta(days=366)
# A done item that GitHub never updated again (e.g. it was closed) is forgotten after this long.
DONE_KEPT = timedelta(days=180)
# Per user; the oldest states go first beyond this.
MAX_STATES = 2000


class InvalidSnooze(ValueError):
    """The snooze time is in the past or more than a year ahead."""


def as_utc(moment: datetime) -> datetime:
    """The same moment with UTC as its zone; a time without a zone counts as UTC."""
    if moment.tzinfo is None:
        return moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


def stored_states(db: Session, user: models.User, now: datetime) -> list[dict]:
    """The user's states that still apply, done ones first, each newest first."""
    states = (
        db.query(models.ItemState)
        .filter(models.ItemState.user_id == user.id)
        .order_by(models.ItemState.done_at.desc(), models.ItemState.snoozed_until.desc())
    )
    current = int(now.timestamp())
    return [
        {
            "url": state.url,
            "done_at": _moment(state.done_at),
            "snoozed_until": _moment(state.snoozed_until),
        }
        for state in states
        if state.snoozed_until is None or state.snoozed_until > current
    ]


def mark_done(db: Session, user: models.User, url: str, now: datetime) -> dict:
    """Mark the item as done now; it shows again once GitHub updates it after this moment."""
    return _save(db, user, url, done_at=int(now.timestamp()), snoozed_until=None, now=now)


def snooze(db: Session, user: models.User, url: str, until: datetime, now: datetime) -> dict:
    """Hide the item until `until`, which must lie within the next year."""
    until = as_utc(until)
    if not now < until <= now + MAX_SNOOZE:
        raise InvalidSnooze("A snooze must end in the future and within a year.")
    return _save(db, user, url, done_at=None, snoozed_until=int(until.timestamp()), now=now)


def forget(db: Session, user: models.User, url: str, now: datetime) -> None:
    """Show the item again; nothing happens if it had no state."""
    db.query(models.ItemState).filter(
        models.ItemState.user_id == user.id, models.ItemState.url == url
    ).delete()
    _drop_ended(db, user, now)
    _cap(db, user, keep=MAX_STATES)
    db.commit()


def _save(
    db: Session, user: models.User, url: str, done_at: int | None, snoozed_until: int | None, now: datetime
) -> dict:
    # First, so the lookup below never finds a row that is about to be deleted.
    _drop_ended(db, user, now)
    existing = (
        db.query(models.ItemState)
        .filter(models.ItemState.user_id == user.id, models.ItemState.url == url)
        .one_or_none()
    )
    # A new state needs room for itself; replacing one doesn't grow the collection.
    _cap(db, user, keep=MAX_STATES if existing else MAX_STATES - 1)
    state = existing or models.ItemState(user_id=user.id, url=url)
    state.done_at = done_at
    state.snoozed_until = snoozed_until
    db.add(state)
    db.commit()
    return {"url": url, "done_at": _moment(done_at), "snoozed_until": _moment(snoozed_until)}


def _drop_ended(db: Session, user: models.User, now: datetime) -> None:
    """Drop ended snoozes and done states kept long enough."""
    current = int(now.timestamp())
    mine = db.query(models.ItemState).filter(models.ItemState.user_id == user.id)
    mine.filter(models.ItemState.snoozed_until <= current).delete()
    mine.filter(models.ItemState.done_at < current - int(DONE_KEPT.total_seconds())).delete()


def _cap(db: Session, user: models.User, keep: int) -> None:
    """Drop the oldest states beyond `keep`."""
    mine = db.query(models.ItemState).filter(models.ItemState.user_id == user.id)
    for state in mine.order_by(models.ItemState.id.desc()).offset(keep).all():
        db.delete(state)


def _moment(timestamp: int | None) -> datetime | None:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc) if timestamp is not None else None
