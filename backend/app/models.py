from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # GitHub's numeric id is stable; the login can be renamed and then taken by someone else.
    github_id = Column(Integer, unique=True, index=True, nullable=False)
    login = Column(String, nullable=False)
    # Tokens are encrypted with crypto.encrypt_token; expiry times are Unix timestamps.
    # Empty when GitHub rejected them and the user has to sign in again.
    github_access_token = Column(String)
    github_access_token_expires_at = Column(Integer)
    github_refresh_token = Column(String)
    github_refresh_token_expires_at = Column(Integer)


class HiddenScope(Base):
    """An owner ("octo-org") or repository ("octo-org/hoot") the user hid from the overview."""

    __tablename__ = "hidden_scopes"
    __table_args__ = (UniqueConstraint("user_id", "scope"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    # Lowercase, because GitHub owner and repository names are case-insensitive.
    scope = Column(String, nullable=False)
