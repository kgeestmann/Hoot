# API

The backend's routes and what they return. With the backend running, FastAPI's built-in reference (every schema, try-it-out) is at `http://localhost:8000/docs`. The Pydantic models are in `backend/app/schemas.py`.

All routes except the first four need a valid session cookie (`hoot_session`) and answer `401` without one. Routes that ask GitHub answer:

- `401` and clear the session cookie when the user's GitHub tokens can't be renewed ([architecture.md](architecture.md#calls-to-github-on-the-users-behalf))
- `502` when GitHub can't be reached or answers with an error

| Route | Purpose |
| --- | --- |
| [`GET /`](#status) | Status |
| [`GET /auth/github/login`](#sign-in) | Start the GitHub sign-in |
| [`GET /auth/github/callback`](#sign-in) | GitHub's redirect after authorizing |
| [`POST /logout`](#logout) | End the session |
| [`GET /profile`](#profile) | The signed-in user |
| [`GET /overview`](#overview) | The four lists for the dashboard |
| [`GET /lists/{name}`](#one-list-page-by-page) | One list, page by page |
| [`GET`/`PUT /overview/filters`](#filters) | The user's filters |
| [`GET /orgs/{organization}/overview`](#team-view) | The team view of an organization |
| [`GET /github/installations`](#github-access) | Where the GitHub App is installed |

## Status

`GET /` returns `{"message": "Hoot backend is running."}`.

## Sign-in

`GET /auth/github/login` is opened by the browser (a link, not an API call). It sets the `hoot_oauth` cookie (state and PKCE verifier, signed, 10 minutes, only sent to `/auth/github`) and redirects (`302`) to GitHub's authorize page.

`GET /auth/github/callback?code=…&state=…` is where GitHub sends the browser back:

1. Check `state` against the `hoot_oauth` cookie (`400` if missing, wrong or expired)
2. Exchange the code for the user's tokens (client secret and PKCE verifier)
3. Load the GitHub user
4. Create or update the user and store the tokens encrypted
5. Set the session cookie and redirect to `FRONTEND_URL`

```
Set-Cookie: hoot_session=<jwt>; HttpOnly; Max-Age=3600; Path=/; SameSite=lax; Secure
```

If the user cancelled on GitHub or GitHub rejected the code, it redirects to `FRONTEND_URL/login?error=github` without a session.

## Logout

`POST /logout` deletes the session cookie and returns `204 No Content`, also when nobody was signed in.

## Profile

`GET /profile`

```json
{ "id": 1, "login": "octocat" }
```

## Overview

`GET /overview` runs four GitHub searches as the user in one GraphQL query, each with the 50 most recently updated results, only in repositories where the GitHub App is installed:

| List | GitHub search |
| --- | --- |
| `assigned_issues` | `is:open is:issue assignee:@me archived:false` |
| `pull_requests` | `is:open is:pr author:@me archived:false` |
| `review_requests` | `is:open is:pr review-requested:@me archived:false` |
| `mentions` | `is:open mentions:@me archived:false` |

Mentions whose latest comment comes from a bot (or, without comments, that a bot opened) are left out.

```json
{
  "pull_requests": [ ... ],
  "review_requests": [ ... ],
  "assigned_issues": [ ... ],
  "mentions": [ ... ],
  "totals": {
    "pull_requests": { "total": 5, "has_more": false, "search_url": "https://github.com/search?q=..." },
    ...
  }
}
```

`totals` per list: `total` is how many items GitHub found, `has_more` is true when that's more than the list holds (50), `search_url` is the same search on github.com.

### Items

Every item:

| Field | |
| --- | --- |
| `kind` | `"issue"` or `"pull_request"` |
| `title`, `number`, `url`, `updated_at` | |
| `repository` | `owner/name` |
| `labels` | First 10 labels as `{ name, color }`; `color` is GitHub's six hex digits, e.g. `"d73a4a"` |
| `comment_count` | Number of comments |
| `milestone` | The milestone's title, or `null` |

Pull requests (in `pull_requests` and on list pages) also carry:

| Field | |
| --- | --- |
| `ci_status` | GitHub's `SUCCESS`, `FAILURE`, `PENDING`, `ERROR`, `EXPECTED`, or `null` without checks |
| `review_decision` | `APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, or `null` |
| `draft` | `true` for draft pull requests |
| `reviewers` | `{ name, state }` per reviewer: `REQUESTED`, or the latest review `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`, `PENDING`. A new request wins over an older review. |
| `checks` | `{ name, state, url }` for each check run and commit status of the last commit. `state` is reduced to `success`, `failure`, `pending` or `neutral` (cancelled, skipped and stale count as neutral). |

## One list, page by page

`GET /lists/{name}?sort=updated|oldest|created&after=<cursor>`

- `name`: `pull_requests`, `review_requests`, `assigned_issues` or `mentions`. The same searches as `/overview`, so pull requests carry CI and review state and mentions skip bot activity.
- `sort`: `updated` (default, recently updated first), `oldest` (created first) or `created` (recently created first).
- `after`: the previous page's `end_cursor`.

```json
{
  "items": [ ... ],
  "total": 120,
  "has_more": true,
  "end_cursor": "Y3Vyc29yOjUw",
  "search_url": "https://github.com/search?q=..."
}
```

Up to 50 items per page; `end_cursor` is `null` on the last page. An unknown name, order or a malformed cursor answers `422`.

## Filters

`GET /overview/filters` returns the user's filters, `PUT /overview/filters` replaces them and returns them as stored:

```json
{ "hidden": ["octo-org", "octocat/old-repo"], "labels": ["bug"] }
```

- `hidden`: owners or `owner/repo` to hide, at most 500
- `labels`: label names to show only (empty: every label), at most 100, each at most 50 characters

Entries are trimmed, lowercased (GitHub names are case-insensitive), de-duplicated and sorted. Anything else answers `422`. A request without `labels` shows every label. The frontend applies the filters; `/overview` itself always returns everything.

## Team view

`GET /orgs/{organization}/overview`

The organization must be one where the GitHub App is installed for the user (otherwise `404`; an invalid name answers `422`). Four searches in the organization with the user's token, each `is:open archived:false`, with GitHub's total, up to 20 items and a link to the full search:

| List | Search | Order |
| --- | --- | --- |
| `waiting_for_review` | `is:pr review:required -is:draft` | oldest first |
| `failing_ci` | `is:pr status:failure` | recently updated first |
| `unassigned_issues` | `is:issue no:assignee` | oldest first |
| `stale` | `updated:<today-60 days` (issues and PRs) | least recently updated first |

```json
{
  "organization": "Octo-Org",
  "stale_after_days": 60,
  "waiting_for_review": { "total": 3, "items": [ ... ], "search_url": "https://github.com/search?q=..." },
  "failing_ci": { ... },
  "unassigned_issues": { ... },
  "stale": { ... }
}
```

Items are like the overview's, plus `created_at`, `author` (`null` for deleted accounts), `assignees`, and `ci_status` / `review_decision` for pull requests. Deliberately no statistics per person: [specs/team-view.md](specs/team-view.md).

## GitHub access

`GET /github/installations` lists the accounts where the GitHub App is installed and the user can use it (GitHub's `GET /user/installations`, first 100; enterprise installations are left out), plus the install URL:

```json
{
  "install_url": "https://github.com/apps/<slug>/installations/new",
  "installations": [
    {
      "account": "octocat",
      "account_type": "User",
      "all_repositories": true,
      "settings_url": "https://github.com/settings/installations/1"
    }
  ]
}
```

`account_type` is `"User"` or `"Organization"`.
