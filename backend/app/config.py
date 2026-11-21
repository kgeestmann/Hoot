import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# RFC 7518 §3.2: an HS256 key must be at least as long as the hash output.
MIN_SECRET_KEY_BYTES = 32


def read_secret_key() -> str:
    """Return SECRET_KEY from the environment, or raise if it is missing or too short."""
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise RuntimeError("SECRET_KEY is not set. Add it to .env (see README).")
    if len(secret_key.encode("utf-8")) < MIN_SECRET_KEY_BYTES:
        raise RuntimeError(
            f"SECRET_KEY must be at least {MIN_SECRET_KEY_BYTES} bytes. "
            "Generate one as described in the README."
        )
    return secret_key


SECRET_KEY = read_secret_key()

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200").split(",")
DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "hoot.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}")
