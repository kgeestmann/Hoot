# Sign-in security

From #44. Requirements for the GitHub sign-in that are easy to miss in an OAuth flow and expensive to retrofit. Each one is covered by a test in `backend/tests/` (mostly `test_github_auth.py`). How the code meets them: [../security.md](../security.md).

## Login flow

- **`state` against login CSRF:** `/auth/github/login` creates a random `state` (`secrets.token_urlsafe(32)`) and keeps it in a short-lived signed HttpOnly cookie; `/auth/github/callback` rejects the request if the two don't match, and each `state` is used only once. Without this, an attacker could sign a victim into the *attacker's* Hoot account.
- **PKCE:** the authorize request sends an S256 `code_challenge`, the code exchange the `code_verifier`. It protects the exchange if the `code` leaks.
- **No open redirect:** after the sign-in, redirect only to the fixed, configured `FRONTEND_URL`. No `next` or `redirect` parameter.
- **No token in a URL:** the Hoot session is never handed over as `?token=…`, because it would end up in browser history, server logs and `Referer` headers. It is set as an HttpOnly cookie in the callback.

## GitHub tokens

- **Encrypted at rest** with Fernet under a separate `TOKEN_ENCRYPTION_KEY`, not the JWT `SECRET_KEY`. A copied `hoot.db` alone must not give access to GitHub accounts.
- **Expiry and refresh:** token expiration stays on. Refresh before expiry or when GitHub answers `401`. If the refresh fails, delete the stored tokens and send the user back to the sign-in.
- **Revocation:** a user revoking Hoot on GitHub makes calls answer `401`; handle it like a failed refresh.
- **Never leaves the backend:** no API response, log line or error message contains a GitHub token. The profile response stays limited to safe fields.
- **Least privilege:** only the read-only permissions Hoot needs. The client secret lives only in `.env`.

## Identity

Users are identified by GitHub's numeric **user id**, not by `login`: logins can be renamed and then claimed by someone else.

## Tests

Mocked tests for: `state` missing or mismatched → `400` and no session; a replayed `state` → rejected; tokens stored encrypted (raw database value ≠ token); no GitHub token in any response body.
