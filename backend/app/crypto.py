from cryptography.fernet import Fernet

from .config import TOKEN_ENCRYPTION_KEY

try:
    _fernet = Fernet(TOKEN_ENCRYPTION_KEY)
except ValueError as error:
    raise RuntimeError("TOKEN_ENCRYPTION_KEY is not a valid Fernet key (see README).") from error


def encrypt_token(token: str) -> str:
    """Encrypt a GitHub token for storage in the database."""
    return _fernet.encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a GitHub token that was stored with encrypt_token."""
    return _fernet.decrypt(encrypted_token.encode("ascii")).decode("utf-8")
