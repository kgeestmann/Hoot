# Sign-in through a GitHub App

From #24, #69 and #72.

## Decision

Users sign in with their GitHub account, and Hoot reads GitHub on their behalf, read-only. Hoot uses a **GitHub App**, not an OAuth App, because a GitHub App

- can be installed per account and organization, so an organization decides whether Hoot may see its repositories,
- has fine-grained, read-only permissions (Issues, Pull requests, Checks, Commit statuses; Metadata is implied) instead of OAuth scopes that grant far more,
- issues user tokens that expire (8 hours, with a 6-month refresh token),
- gets higher rate limits, and can receive webhooks later.

## Consequences

- **A token only reaches accounts where the app is installed.** After signing in, an empty list can mean "not installed" rather than "nothing waiting". Hoot therefore shows where it is installed (`GET /github/installations`), an install banner while it is installed nowhere, and a *GitHub access* page with a link to GitHub's install page. Members who aren't owners can request it for an organization; outside collaborators have to ask an owner.
- **Hoot can't list the organizations where it's still missing.** `GET /user/orgs` only returns memberships, never organizations where the user only collaborates (tested with a real token in #96). GitHub's install page lists every account the user can install or request it for.
- **Each running Hoot needs its own app**, because the client secret must stay private. Users of a running Hoot only sign in. For local installs, `backend/setup_github_app.py` registers the app from a manifest (#72), so nobody has to click through GitHub's form.
- **"Request user authorization (OAuth) during installation" stays off.** With it on, GitHub calls the callback right after installing, without Hoot's `state`, and the sign-in fails by design. Signing in always starts from Hoot's button.
- **Tokens must be refreshed.** Every call on a user's behalf goes through `github_tokens.call_as_user` (see [../architecture.md](../architecture.md#calls-to-github-on-the-users-behalf)).

## Alternatives considered

- **OAuth App:** simpler setup, but broad scopes (`repo` grants write access to every private repository), no per-organization installation and tokens that don't expire.
- **Personal access tokens:** every user would have to create and paste one; not a sign-in.
