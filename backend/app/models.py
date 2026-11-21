from sqlalchemy import Column, Integer, String
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
