# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Hoot shows everything that is waiting on the user on GitHub (assigned issues, open PRs, review requests, mentions) on one page. It is being built on top of a minimal full-stack JWT login: a FastAPI + SQLAlchemy backend on SQLite and an Angular 22 (Material) frontend. The open issues hold the roadmap. The default branch is `main`, and the main dev machine is Windows.

## Commands

```bash
pip install -r backend/requirements.txt               # in a venv (backend/venv/ is gitignored)
uvicorn backend.app.main:app --reload                 # from the repo root → http://localhost:8000
pytest                                                # backend tests (backend/tests/, temp SQLite DB)
pytest backend/tests/test_auth.py::test_profile_returns_the_logged_in_user   # single test

cd frontend
npm install                                           # needs Node 24 LTS; Node >= 25 breaks localStorage in the jsdom tests
npm start                                             # ng serve → http://localhost:4200
npm test                                              # ng test (Vitest + jsdom)
npm run build
```

The backend reads a `.env` in the repo root via `backend/app/config.py`. Only `SECRET_KEY` is required, and the backend refuses to start without it or with one shorter than 32 bytes. `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` and `CORS_ORIGINS` (comma-separated) have defaults that are documented in the README. Prettier is configured in `frontend/.prettierrc`; there is no linter. The `Tests` workflow (`.github/workflows/tests.yml`) runs `pytest` and the frontend tests on every PR and on pushes to `main`. Don't merge while it is red.

## Code comments

- Give functions and methods a short docstring directly under the signature that says what they do. Mention parameters or return values only when they aren't obvious.
- Keep inline comments short, and add them only where the code isn't self-explanatory. They describe the current code.
- Don't write comments about history or the change itself ("previously", "now", "fixed", "without this … would …"), comments that only restate the code, or long justifications. Those belong in the commit message or the PR description.

## Architecture

- **Backend (`backend/app/`)** is a small FastAPI app. `config.py` loads `.env` and holds all settings. `main.py` holds CORS, bcrypt hashing (`hash_password` / `verify_password`), JWT creation and validation (PyJWT) and all routes: `/register`, `/login` (OAuth2 *form* data, with `username` = email) and `/profile` (protected). Tables are created with `Base.metadata.create_all` on import. There are no migrations, so a model change needs a fresh DB or a manual `ALTER`.
- **Auth flow:** `/login` returns `{access_token, token_type}` with `sub` = the user id as a string. `get_current_user` decodes the token and loads the user, and protected routes depend on it.
- **Frontend (`frontend/src/app/`)** uses standalone components and is **zoneless** (no zone.js): the view only re-renders on signal updates, template events or `markForCheck`. Keep state that templates read in signals; a plain field set inside `subscribe` won't show up (see #35). `services/auth.ts` keeps the JWT in `localStorage` (`token`) and calls the backend at the hard-coded `http://localhost:8000`. `guards/auth-guard.ts` protects `/profile`, and `guards/public-guard.ts` keeps logged-in users away from `/login` (routes are in `app.routes.ts`). Shared UI lives in `layout/` (sidenav, ui-button, ui-card).
- **Contract between the two halves:** the login request is `application/x-www-form-urlencoded` (because of `OAuth2PasswordRequestForm`), not JSON. If you change the backend auth or the CORS origins, check `auth.ts` and `CORS_ORIGINS` as well.

## Keeping docs in sync

The README is the documentation, covering setup, `.env`, routes and the architecture. If a change affects any of these, update the README **in the same PR**. If the README and the code disagree, the code wins: fix the README, or file an issue if the code is wrong.

## Filing issues

If you find a bug, a gap or a docs/code mismatch outside the current task, **file it right away** with `gh issue create`. Don't silently fix it inside an unrelated change. Include the `file:line`, a concrete failure scenario and the expected behaviour. Mention the issue number in your summary or PR description.

Label every issue and PR (`--label` on `gh issue create` / `gh pr create`): one type (`bug`, `enhancement`, `documentation`), the area (`backend`, `frontend`), and `security` or `dependencies` where they apply. A PR carries the labels of the issue it closes. Create a new label only when none of these fits.

## Git & PR workflow

Every change (feature, fix or docs) starts from a GitHub issue and gets its own branch and PR:

1. **Issue:** use the existing one, or create it first with `gh issue create`. One issue = one branch = one PR.
2. **Branch from the issue:**
   ```bash
   gh issue develop <n> --name <type>/<n>-short-description --base main --checkout
   ```
   This links the branch under the issue's *Development* section. `<type>` is the Conventional Commit type (`feat`, `fix`, `docs`, …). Never commit directly to `main`.
3. **Commit** using Conventional Commits.
4. **Before the PR:** run `pytest` and, when the frontend changed, `npm test` in `frontend/`.
5. **PR:** put `Closes #<n>` in the description so the merge closes the issue and links it to the PR.
6. **Review and merge:** the `claude-code-review` workflow reviews each PR automatically. For an on-demand review or a question, write `@claude` in a PR or issue comment. Act on valid findings, then merge with `gh pr merge <n> --merge --delete-branch`.

No confirmation is needed in this repo to commit, push, open or merge your own PRs (approved by the owner). Force-push and history rewrites still need explicit approval.

Gotchas for the review workflow:

- It does not review PRs that change `.github/workflows/claude*.yml`, because the action only runs when the workflow file matches `main`.
- It skips PRs that Claude has already commented on. Use `@claude` to get a re-review.
