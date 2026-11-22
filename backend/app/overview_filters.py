from sqlalchemy.orm import Session

from . import models


def stored_filters(db: Session, user: models.User) -> dict[str, list[str]]:
    """Return the user's overview filters: hidden owners/repositories and shown labels, sorted."""
    hidden = db.query(models.HiddenScope.scope).filter(models.HiddenScope.user_id == user.id)
    labels = db.query(models.ShownLabel.label).filter(models.ShownLabel.user_id == user.id)
    return {
        "hidden": sorted(scope for (scope,) in hidden),
        "labels": sorted(label for (label,) in labels),
    }


def replace_filters(db: Session, user: models.User, hidden: list[str], labels: list[str]) -> None:
    """Store exactly these filters for the user, in one transaction."""
    db.query(models.HiddenScope).filter(models.HiddenScope.user_id == user.id).delete()
    db.query(models.ShownLabel).filter(models.ShownLabel.user_id == user.id).delete()
    db.add_all(models.HiddenScope(user_id=user.id, scope=scope) for scope in hidden)
    db.add_all(models.ShownLabel(user_id=user.id, label=label) for label in labels)
    db.commit()
