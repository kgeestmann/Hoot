# Components

The reusable building blocks of the frontend. Before writing new UI, check here: most views are a combination of these. Paths are relative to `frontend/src/app/`. Page components are in [pages.md](pages.md).

## Layout and states (`layout/`)

### `app-sidenav` (`layout/sidenav`)

The app shell: a `mat-sidenav` beside a top bar with the page title and the `router-outlet`.

- Header: the logo and "Hoot".
- Navigation (`mat-nav-list`): *Overview*, the four list pages from `LIST_PAGES` with their counts (after the filters, from `OverviewStore`), *Teams* with every organization where Hoot is installed, and *GitHub access* at the bottom.
- Account button: the login's initial and login, opening a menu with *Profile* and *Sign out*.
- Shows `app-install-banner` above every page except *GitHub access* while Hoot is installed nowhere.
- Open beside the content from 840 px, a drawer below that closes once a page is chosen.

### `app-load-error` (`layout/load-error`)

An error box that says what failed, with *Try again*.

| | |
| --- | --- |
| `message` (input, required) | The text to show |
| `retry` (output) | *Try again* was clicked |

Use `loadErrorMessage(error)` from the same file to build the message: it tells Hoot's server being unreachable apart from GitHub failing.

### `app-list-skeleton` (`layout/list-skeleton`)

Grey placeholders in the shape of a list, shown while it loads.

| | |
| --- | --- |
| `label` (input, required) | What is loading, read out by screen readers, e.g. "Loading your overview" |
| `tabs` (input, default `true`) | Draw a tab row above the rows; pass `false` on pages without tabs |

### `app-install-banner` (`layout/install-banner`)

Explains that Hoot can't see any repository yet, with *Install Hoot on GitHub* and a link to the *GitHub access* page.

| | |
| --- | --- |
| `installUrl` (input, required) | GitHub's install page for the app |

### `app-github-access` (`pages/github-access/github-access`)

The card listing where Hoot can see the user's repositories: each account with all or selected repositories and *Manage* on GitHub, *Add an account or organization*, and a hint for members and outside collaborators. Asks to install the app when it is installed nowhere. Used by the *GitHub access* page.

| | |
| --- | --- |
| `access` (input, required) | The `GitHubAccess` from `GET /github/installations` |

## Items (`pages/overview/item/`)

### `app-item-meta`

The line under an item's title: kind, `owner/repo#number`, how long ago it was updated; for team items also when and by whom it was opened and who is assigned.

| | |
| --- | --- |
| `item` (input, required) | An `OverviewItem` or `TeamItem` |

Its template starts right after the backtick on purpose: a leading line break would render as a leading space and shift the line right of the title.

### `app-item-chips`

An item's CI and review status (icon, text and colour) followed by its GitHub labels in their colours. Use `hasChips(item)` to skip the row when there is nothing to show.

| | |
| --- | --- |
| `item` (input, required) | An `OverviewItem` or `PullRequestItem` |

Helpers in the same folder:

- `status-chips.ts`: `statusChips(item)` turns CI and review state into chips with a tone (`success`, `danger`, `neutral`) and icon; `DRAFT_CHIP` for drafts.
- `label-colors.ts`: `labelColors(color)` picks dark or white text for a label colour, whichever has more contrast.
- `relative-time.ts`: `relativeTime(date)` gives "3 hours ago", "yesterday", …

## Lists

### `app-overview-section` (`pages/overview/overview-section`)

One list of items as `mat-nav-list` rows (title, `item-meta`, `item-chips`), or an empty text.

| | |
| --- | --- |
| `items` (input, required) | The items |
| `emptyText` (input, required) | Shown when there are none |
| `heading` (input) | Optional heading above the list |
| `total` (input) | GitHub's total, when more exist than `items` |
| `moreUrl` (input) | The full search on GitHub, linked when there are more |

### `app-list-tabs` (`pages/overview/list-tabs`)

Lists as Material tabs with a count each, every tab holding an `app-overview-section`. Used by the team view.

| | |
| --- | --- |
| `tabs` (input, required) | `ListTab[]`: `label`, `count`, `items`, `emptyText`, and optional `total` and `moreUrl` |
| `selectedIndex` (model) | The open tab |

### `app-item-panels` (`pages/list/item-panels`)

Items as Material expansion panels for the list pages. Collapsed, a panel reads like a list row; expanded, it shows `app-item-details`.

| | |
| --- | --- |
| `items` (input, required) | The items |

### `app-item-details` (`pages/list/item-panels`)

The details of one item: comment count and milestone, and for pull requests the draft state, every reviewer with their state and every CI check with its result and a link, plus *Open on GitHub*.

| | |
| --- | --- |
| `item` (input, required) | The item |

## Done and snooze (`pages/overview/item-state/`)

### `app-item-actions`

A three-dot menu (`more_vert`) for one item: *Mark as done*, and *Snooze* with *Later today* (in 3 hours), *Tomorrow*, *Next week* (Monday) and *Pick a date* (9:00 in the user's time). Confirms with a snack bar offering *Undo*, and says so when saving fails (the item then shows again). On the overview it sits beside each row's link; on the list pages next to *Open on GitHub*.

| | |
| --- | --- |
| `item` (input, required) | The item the menu acts on |

The snack bar and the date dialog (`snooze-dialog.ts`, a `mat-calendar` from tomorrow up to a year ahead) live in `item-feedback.ts`, which the menu loads on first use, so they stay out of the page bundles. The menu reaches them through the environment injector: its row, and the menu with it, disappears as soon as the item is marked, before the snack bar has loaded.

Helpers: `snooze-times.ts` (`laterToday`, `tomorrow`, `nextWeek`, `morningOf`, `pickableDays`) and `item-state-store.ts` (`isSettled`, `withoutSettled`, `overviewWithoutSettled`, `ItemStateStore`).

## Filters and refresh

### `app-filter-bar` (`pages/overview/filters/filter-bar`)

*Owner*, *Repository* and *Label* buttons opening Material menus of `menuitemcheckbox` options (with `mat-pseudo-checkbox`), then "Showing 12 of 15 · 3 hidden" and *Clear filters*. A button names its state ("Owner: 2 of 3", "Label: bug").

| | |
| --- | --- |
| `owners` (input, required) | `OwnerOption[]` with their repositories, from `filterOptions` |
| `labels` (input, required) | `LabelOption[]` |
| `shownCount`, `totalCount` (inputs, required) | For the summary |
| `saveFailed` (input) | Shows that saving failed |
| `toggleScope`, `toggleLabel`, `clear` (outputs) | Pass them to `FilterState` |

The logic is in plain functions in `filtering.ts` (`applyFilters`, `filterItems`, `filterOptions`, `filterOptionsFor`, `countItems`, `toggleEntry`), and the shared state in `filter-state.ts`. Pages connect the bar to `FilterState`; they don't keep their own copy of the filters.

### `app-refresh-status` (`pages/overview/refresh-status`)

"Updated 5 minutes ago" with a refresh button, a progress bar while refreshing and "Couldn't refresh" after a failure. Asks for a refresh by itself when the user returns to the browser tab after more than 5 minutes.

| | |
| --- | --- |
| `loadedAt` (input, required) | When the shown data arrived |
| `refreshing`, `failed` (inputs) | Current state |
| `refresh` (output) | A refresh is wanted |

## Data helpers

| File | Exports |
| --- | --- |
| `pages/overview/summary.ts` | `summarize(overview, filters)`: per list its count ("+" when GitHub cut it off), used by the overview's tiles and the sidebar. `latest(overview, filters)`: the 8 most recently updated items across all lists, each with its list, every item once. |
| `pages/list/list-pages.ts` | `LIST_PAGES` (path, list, title, item label, icon, empty text of each list page) and `SORT_OPTIONS` |
| `pages/list/work-list.ts` | `groupByRepository(items)` |

## Adding a component

- Standalone, `ChangeDetectionStrategy` as in the surrounding components, `input()`/`output()`/`model()` signals.
- A short docstring above the class saying what it is.
- Shared by several pages: `layout/` for app-wide UI, otherwise the folder of the feature that owns it.
- A spec next to it, and an entry on this page.
