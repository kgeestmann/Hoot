# Security

What Hoot protects and how. The binding rules for the sign-in are in [specs/sign-in-security.md](specs/sign-in-security.md); this page describes how the code meets them.

## No passwords, no copies of GitHub data

Signing in is delegated to GitHub; Hoot stores no passwords. It also keeps no copy of issues or pull requests: every page asks GitHub with the user's own token, so a user only sees what they can see on GitHub.

## GitHub tokens

- Stored **encrypted** with Fernet (`backend/app/crypto.py`) under `TOKEN_ENCRYPTION_KEY`, which is separate from the JWT key. A copied `hoot.db` alone gives no access to GitHub accounts. Store tokens only through `encrypt_token`.
- **Never leave the backend:** no API response, log line or error message contains one.
- **Least privilege:** the GitHub App only has read-only access to issues, pull requests, checks and commit statuses.
- Expired tokens are refreshed; if that fails or the user revoked Hoot, the stored tokens are deleted and the user has to sign in again.

## Sign-in

- **`state`** against login CSRF and **PKCE** (S256) for the code exchange, both kept in the short-lived signed cookie `hoot_oauth` and used once.
- **No open redirect:** after the sign-in the browser always goes to the fixed `FRONTEND_URL`. Redirect parameters are ignored.
- **No token in a URL:** the session is handed over as an HttpOnly cookie, never as a query parameter.
- Users are identified by GitHub's numeric id, not by login, because logins can be renamed and taken over.

## Session cookie

`hoot_session` holds the JWT (user id, `auth_time`, expiry) and is:

- `HttpOnly`: unreadable for JavaScript, so XSS can't steal it
- `SameSite=Lax`: other sites can't send it along with POST requests
- `Secure` by default (`COOKIE_SECURE`)

Sessions end after `ACCESS_TOKEN_EXPIRE_MINUTES` without requests, and at the latest `SESSION_MAX_DAYS` after signing in. The frontend never stores a token, in `localStorage` or anywhere else.

## CORS

Only the origins in `CORS_ORIGINS` may call the API with credentials. The frontend and backend must be the same site (`localhost`, not `127.0.0.1`) for the cookie to be sent.

## Privacy

- **No third-party requests from the frontend:** fonts (Roboto via `@fontsource`) and icons (Material Symbols as SVG paths in `icons.ts`) are self-hosted. Loading them from Google's CDN would send every visitor's IP address to Google.
- The sidebar shows the login's initial instead of the GitHub avatar, which would load from GitHub's servers.
- The team view has no metrics per person: [specs/team-view.md](specs/team-view.md).

## Secrets in the repo

`.env` is gitignored and must never be committed. `.env.example` holds placeholders only. Every secret comes from the environment; nothing is hard-coded.
