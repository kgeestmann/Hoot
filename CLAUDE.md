# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. `backend/CLAUDE.md` and `frontend/CLAUDE.md` hold the rules for each half and are loaded when working there.

Hoot shows everything that is waiting on the user on GitHub (assigned issues, open PRs, review requests, mentions) on one page, plus a team view per organization. A FastAPI + SQLAlchemy backend on SQLite and an Angular 22 (Material) frontend. The open issues hold the roadmap. The default branch is `main`, and the main dev machine is Windows.

## Commands

```bash
pip install -r backend/requirements-dev.txt           # in venv/ in the repo root (gitignored); runtime deps are in requirements.txt
python backend/setup_github_app.py                    # once: creates the GitHub App from a manifest and fills .env
python backend/app/main.py                            # → http://localhost:8000 with reload; same as uvicorn backend.app.main:app --reload
pytest                                                # backend tests (backend/tests/, temp SQLite DB, fake GitHub)
pytest backend/tests/test_auth.py::test_profile_returns_the_logged_in_user   # single test

cd frontend
npm install                                           # needs Node 24 LTS; Node >= 25 breaks localStorage in the jsdom tests
npm start                                             # ng serve → http://localhost:4200
npm run demo                                          # same with made-up data, no backend or GitHub (?scenario=full|empty|not-installed|errors)
npm test                                              # ng test (Vitest + jsdom)
npm run build

docker compose up -d --build                          # the server setup (backend + Caddy with HTTPS), needs DOMAIN in .env; see docs/deployment.md
```

Settings come from `.env` in the repo root (`backend/app/config.py`, every variable in `.env.example`). Prettier is configured in `frontend/.prettierrc`; there is no linter. The `Tests` workflow (`.github/workflows/tests.yml`) runs `pytest` and the frontend tests on every PR and on pushes to `main`. Don't merge while it is red.

## Contract between the two halves

- The login page links to `/auth/github/login` (a full page navigation, not an API call), and the backend sends the browser back to `FRONTEND_URL` or `FRONTEND_URL/login?error=github`.
- The session is the HttpOnly cookie `hoot_session`. It only works when frontend and backend are the same site (`localhost`, not `127.0.0.1`) and CORS allows credentials from the exact frontend origin. If you change the backend auth or the CORS origins, check `frontend/src/app/services/auth.ts`, the session interceptor and `CORS_ORIGINS` as well.
- The frontend's response types (`frontend/src/app/services/*.ts`) mirror `backend/app/schemas.py`, and the demo backend (`frontend/src/app/demo/`) mirrors the routes. A route or response change updates all three.

## Where things are documented

The docs are part of the code: update them **in the same PR** as the change. If docs and code disagree, the code wins: fix the docs, or file an issue if the code is wrong.

| When you change … | Update |
| --- | --- |
| Setup, commands, versions, the GitHub App, demo mode, tests | `docs/development.md` (and the quick start in `README.md` if it changes) |
| A setting in `config.py` | `.env.example` and `docs/configuration.md` |
| Docker, Caddy, the server setup | `docs/deployment.md` |
| A route, request or response | `docs/api.md`, the demo backend (`frontend/src/app/demo/`) |
| Sign-in, session, token handling, the database model | `docs/architecture.md`, `docs/security.md` if security-relevant |
| A backend module or how to extend the backend | `docs/backend.md`, `backend/CLAUDE.md` |
| Frontend structure, routing, shared state, services | `docs/frontend/architecture.md`, `frontend/CLAUDE.md` |
| Tokens, colours, buttons, icons, the logo | `docs/frontend/design-system.md` |
| A reusable component (new, inputs, outputs) | `docs/frontend/components.md` |
| What a page shows or does | `docs/frontend/pages.md` |
| A rule or decision in `docs/specs/` | Only with an issue for the decision; update the spec in the same PR |
| The issue / PR workflow | `CONTRIBUTING.md` and this file |

`docs/README.md` is the index; add new docs there. `frontend/README.md` is the frontend's entry point and links into `docs/frontend/`.

## Writing

- English only. No emojis in the UI, code or docs: they look different on every system, ignore the theme colours and get read out by screen readers.
- Don't write "generated" in docs or prose; say what actually happens ("built into FastAPI", "creates a random key"). Keep it only in literal commands or UI labels.
- Docs describe the current state. History belongs in commit messages and PR descriptions.

## Code comments

- Give functions and methods a short docstring directly under the signature that says what they do. Mention parameters or return values only when they aren't obvious.
- Keep inline comments short, and add them only where the code isn't self-explanatory. They describe the current code.
- Don't write comments about history or the change itself ("previously", "now", "fixed", "without this … would …"), comments that only restate the code, or long justifications. Those belong in the commit message or the PR description.

## Filing issues

If you find a bug, a gap or a docs/code mismatch outside the current task, **file it right away** with `gh issue create`. Don't silently fix it inside an unrelated change. Include the `file:line`, a concrete failure scenario and the expected behaviour. Mention the issue number in your summary or PR description.

Label every issue and PR (`--label` on `gh issue create` / `gh pr create`): one type (`bug`, `enhancement`, `documentation`), the area (`backend`, `frontend`), and `security` or `dependencies` where they apply. A PR carries the labels of the issue it closes. Create a new label only when none of these fits.

Assign every issue to whoever opens it. When you file one, that's the account `gh` is signed in as, so pass `--assignee @me` to `gh issue create`.

## Git & PR workflow

Every change (feature, fix or docs) starts from a GitHub issue and gets its own branch and PR (also in `CONTRIBUTING.md`):

1. **Issue:** use the existing one, or create it first with `gh issue create`. One issue = one branch = one PR.
2. **Branch from the issue:**
   ```bash
   gh issue develop <n> --name <type>/<n>-short-description --base main --checkout
   ```
   This links the branch under the issue's *Development* section. `<type>` is the Conventional Commit type (`feat`, `fix`, `docs`, …). Never commit directly to `main`.
3. **Commit** using Conventional Commits.
4. **Before the PR:** run `pytest` and, when the frontend changed, `npm test` in `frontend/`.
5. **PR:** put `Closes #<n>` in the description so the merge closes the issue and links it to the PR.
6. **Review and merge:** the `claude-code-review` workflow reviews each PR automatically, and GitHub Copilot reviews too when its quota allows. Read both, act on valid findings, and reply to the ones you don't adopt with the reason. For an on-demand review or a question, write `@claude` in a PR or issue comment. Then merge with `gh pr merge <n> --merge --delete-branch`.

`main` is protected by the ruleset *Protect main*: pull requests only, the `backend` and `frontend` checks required, no force pushes or deletion, no bypass. A direct push to `main` is rejected.

No confirmation is needed in this repo to commit, push, open or merge your own PRs (approved by the owner). Force-push and history rewrites still need explicit approval.

Gotchas for the review workflow:

- It does not review PRs that change `.github/workflows/claude*.yml`, because the action only runs when the workflow file matches `main`.
- It skips PRs that Claude has already commented on. Use `@claude` to get a re-review.
