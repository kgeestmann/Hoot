# Pages

What each page shows and how it behaves. Paths are relative to `frontend/src/app/`. Routing and guards: [architecture.md](architecture.md#routing).

## Sign in (`/login`, `pages/login`)

A card with the logo, a short description and *Sign in with GitHub*. The button is a plain link to `/auth/github/login` on the backend, because the sign-in is a full page navigation to GitHub and back. With `?error=github` the page explains that the sign-in failed or was cancelled. Signed-in users are sent to `/`.

## Overview (`/`, `pages/overview`)

The start page: a dashboard of everything waiting on the user. It loads `GET /overview` through `OverviewStore` (shared with the sidebar counts) and the filters through `FilterState`.

- **Four cards** (`mat-card`, data from `summary.ts`): *Pull requests*, *Review requests*, *Assigned issues* and *Mentions*. Each has its icon, the number of items the filters let through ("50+" when GitHub cut the list off), the 3 most recently updated items as rows linking to GitHub (title and `item-meta`), and *Show all*, which opens the list page.
- **Done and snooze:** each row has a three-dot menu ([components.md](components.md#app-item-actions)). A done item stays hidden until GitHub updates it again; a snoozed one until its time. Counts on the cards and in the sidebar leave them out, and "Nothing waiting on you." shows when everything is done.
- **Filter bar** above the cards. Unchecking an owner or repository hides it; new owners and repositories show up automatically, and a hidden owner's repositories are disabled. Picking labels shows only items carrying at least one of them. Card counts follow the filters, and a card whose items are all filtered out says so. Changes are saved per user, one after the other; if saving fails, the filters still apply until the page is reloaded.
- **Refresh status** beside the filters. A refresh keeps the cards visible under a progress bar and updates the sidebar counts too. Coming back to the tab after more than 5 minutes refreshes on its own, which also keeps the session alive.
- **States:** skeleton while loading; an empty text per card; "Nothing waiting on you." with the `task_alt` icon above the cards when all four are empty (the cards stay, the filter bar only while a filter is active); an error with *Try again*. While Hoot is installed nowhere, the install banner explains the empty lists instead.

## List pages (`/pull-requests`, `/review-requests`, `/assigned`, `/mentions`, `pages/list/work-list`)

Each list on its own page, configured in `list-pages.ts` (path, title, icon, empty text) and linked in the sidebar with its count.

- **Every item:** the first 50 load with the page; *Load more* appends the next 50 ("Loaded 50 of 120"). If that fails, the loaded items stay with "Couldn't load more".
- **Expandable entries** (`item-panels`): collapsed, an item reads like an overview row (title, meta line, status and label chips, *Draft* for drafts); expanded, it shows its details (`item-details`), *Open on GitHub* and the done and snooze menu. Done and snoozed items are left out of the list.
- **Sort** menu: *Recently updated*, *Oldest first*, *Recently created*. Changing it reloads from the start while the current items stay visible. An answer that arrives after a newer request is dropped.
- **Group by repository** (slide toggle): one section per repository, sorted by name, with its count.
- **Filter bar** and **refresh status** as on the overview. Filters are shared, so a change on one page applies everywhere and is saved once.

## Team view (`/orgs/:organization`, `pages/organization`)

What needs a team's attention in one organization, from `GET /orgs/{organization}/overview`. Listed in the sidebar under *Teams* for every organization where Hoot is installed.

- **Tabs** (`list-tabs`): *Waiting for review*, *Failing CI*, *Unassigned* and *No update for 60 days*, each with GitHub's total and a link to the full search when there are more than the 20 loaded. The page opens on the first tab with items.
- Items say when and by whom they were opened and who is assigned.
- Refresh status as on the overview; it keeps the open tab.
- Loading, error (with "Hoot isn't installed on …" for a 404) and empty states like the overview.
- No numbers per person, by design: [../specs/team-view.md](../specs/team-view.md).

## GitHub access (`/github-access`, `pages/github-access`)

Linked at the bottom of the sidebar. A card (`app-github-access`, see [components.md](components.md#app-github-access-pagesgithub-accessgithub-access)) from `GET /github/installations`: the accounts Hoot can see (all or selected repositories, with *Manage* on GitHub), *Add an account or organization*, and a hint for members and outside collaborators who can't install it themselves. If the app is installed nowhere, the card asks the user to install it.

## Profile (`/profile`, `pages/profile`)

The signed-in user's id and GitHub login as a Material list in a card.

## Every page

- The title comes from the route and shows as the single `h1` in the top bar and in the browser tab ("Hoot: Overview").
- The sidebar marks the current page.
- A `401` from the backend during a session (expired, or GitHub access revoked) opens `/login`.
