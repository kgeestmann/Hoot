# Team view without per-person metrics

From #28.

## Rule

The organization view (`/orgs/:organization`) shows **work items and team totals only**. Never add counts, statistics, rankings or response-time metrics per person.

## Why

In Germany, a tool that can monitor employees' behaviour or performance usually needs the works council's approval (§ 87 Abs. 1 Nr. 6 BetrVG), and per-person evaluations fall under the GDPR. A team view is also more useful: it shows what needs attention, not who to blame.

Names on items are there on purpose (author and assignees), so the team knows who to talk to about an item. What's excluded is aggregating them into numbers per person.

## What the view shows

Organizations where the Hoot GitHub App is installed and the user can use it. Everything is loaded with the user's own token, so it only contains repositories the user can see anyway. Four lists, each with GitHub's total, up to 20 items and a link to the full search (`archived:false` everywhere):

| List | Search | Order |
| --- | --- | --- |
| Waiting for review | `org:X is:pr is:open review:required -is:draft` | oldest first |
| Failing CI | `org:X is:pr is:open status:failure` | recently updated first |
| Unassigned issues | `org:X is:issue is:open no:assignee` | oldest first |
| Stale | `org:X is:open updated:<today-60d` (issues and PRs) | least recently updated first |

Items show title, kind, `repo#number`, how long they've been open, author and assignees, and CI and review chips for pull requests. The stale threshold is fixed at 60 days.

## Checklist for changes

Before adding anything to the team view, ask: does it count, rank or time something **per person**? If yes, it doesn't go in.
