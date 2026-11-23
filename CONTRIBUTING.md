# Contributing

How changes get into Hoot. Setting up a local copy is described in [docs/development.md](docs/development.md).

## Workflow

Every change (feature, fix or docs) starts from a GitHub issue and gets its own branch and pull request. One issue, one branch, one PR.

1. **Issue:** use the existing one, or open it first. Say what's wrong or missing, with the `file:line` and a concrete scenario for a bug, and the expected behaviour.
2. **Branch** from the issue, so it shows up under the issue's *Development* section:

   ```
   gh issue develop <n> --name <type>/<n>-short-description --base main --checkout
   ```

   `<type>` is the commit type (`feat`, `fix`, `docs`, …). Never commit to `main` directly.
3. **Commit** with [Conventional Commits](#commit-messages).
4. **Before the PR:** run `pytest`, and `npm test` in `frontend/` when the frontend changed. Format changed frontend files with Prettier.
5. **Pull request:** put `Closes #<n>` in the description, so the merge closes the issue.
6. **Review and merge:** CI (`Tests`) and the automatic review must pass. Act on valid findings, then merge with `gh pr merge <n> --merge --delete-branch`. Don't merge while CI is red.

`main` is protected by the ruleset *Protect main* (repo settings → Rules): changes only through pull requests, the `backend` and `frontend` checks must pass, and force pushes and deleting the branch are blocked, for everyone including admins. No approval is required, because nobody can approve their own PR. The `claude-review` check isn't required, because it skips some PRs (e.g. docs-only ones).

Something you notice outside your current change (a bug, a gap, docs that disagree with the code) gets its own issue instead of a silent fix in an unrelated PR.

## Labels

Every issue and PR gets:

- one type: `bug`, `enhancement` or `documentation`
- the area: `backend`, `frontend` (both if both)
- `security` or `dependencies` where they apply

A PR carries the labels of the issue it closes. Issues are assigned to whoever opens them (`gh issue create --assignee @me`).

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): short description`, with the body explaining *why*.

| Type | For |
| --- | --- |
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Tooling, dependencies, config, build |
| `perf` | Performance |
| `style` | Formatting only |

The scope is optional, e.g. `feat(frontend): …`, `fix(backend): …`.

## Code

- Match the surrounding code; Prettier formats the frontend (`frontend/.prettierrc`).
- Give functions and components a short docstring saying what they do. Keep inline comments for the non-obvious *why*; history and justifications belong in the commit message or PR.
- Write tests for non-trivial logic. Never weaken a test to make it pass.
- No secrets in code or commits: settings come from `.env`, which is gitignored.
- No emojis in the UI, code or docs.

## Documentation

Docs change in the same PR as the code they describe. [CLAUDE.md](CLAUDE.md#where-things-are-documented) maps each kind of change to the file to update. If docs and code disagree, the code wins: fix the docs, or open an issue if the code is wrong.

## Reviews

The `claude-code-review` workflow reviews each PR automatically; GitHub Copilot reviews too when it is enabled. For an on-demand review or a question, write `@claude` in a PR or issue comment. The automatic review skips PRs that change `.github/workflows/claude*.yml` (the action only runs when the workflow matches `main`) and PRs it has already commented on.
