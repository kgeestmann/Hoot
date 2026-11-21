from sqlalchemy.orm import Session

from . import models


def hidden_scopes(db: Session, user: models.User) -> list[str]:
    """Return the owners and repositories the user hid from the overview, sorted."""
    rows = db.query(models.HiddenScope.scope).filter(models.HiddenScope.user_id == user.id)
    return sorted(scope for (scope,) in rows)


def replace_hidden_scopes(db: Session, user: models.User, scopes: list[str]) -> None:
    """Store exactly these owners and repositories as hidden for the user."""
    db.query(models.HiddenScope).filter(models.HiddenScope.user_id == user.id).delete()
    db.add_all(models.HiddenScope(user_id=user.id, scope=scope) for scope in scopes)
    db.commit()
