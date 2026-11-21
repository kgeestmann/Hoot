import { Overview, OverviewItem } from '../../../services/overview';

/** A repository in the filter panel; `scope` is its lowercase "owner/name". */
export interface RepositoryOption {
  name: string;
  scope: string;
  hidden: boolean;
}

/** An owner (user or organization) in the filter panel with its repositories. */
export interface OwnerOption {
  name: string;
  scope: string;
  hidden: boolean;
  repositories: RepositoryOption[];
}

const SECTIONS = ['pull_requests', 'review_requests', 'assigned_issues', 'mentions'] as const;

/** Tell whether the item's owner or repository is hidden; GitHub names are case-insensitive. */
export function isHidden(item: OverviewItem, hidden: ReadonlySet<string>): boolean {
  const repository = item.repository.toLowerCase();
  return hidden.has(repository) || hidden.has(ownerOf(repository));
}

/** The overview without the hidden owners and repositories. */
export function applyFilters(overview: Overview, hidden: ReadonlySet<string>): Overview {
  return {
    pull_requests: overview.pull_requests.filter((item) => !isHidden(item, hidden)),
    review_requests: overview.review_requests.filter((item) => !isHidden(item, hidden)),
    assigned_issues: overview.assigned_issues.filter((item) => !isHidden(item, hidden)),
    mentions: overview.mentions.filter((item) => !isHidden(item, hidden)),
  };
}

export function countItems(overview: Overview): number {
  return SECTIONS.reduce((total, section) => total + overview[section].length, 0);
}

/**
 * The owners and repositories to offer in the filter panel, sorted by name: those that appear in
 * the overview, plus hidden ones that don't, so they can be shown again.
 */
export function filterOptions(overview: Overview, hidden: ReadonlySet<string>): OwnerOption[] {
  const owners = new Map<string, OwnerOption>();

  const addOwner = (name: string): OwnerOption => {
    const scope = name.toLowerCase();
    let owner = owners.get(scope);
    if (!owner) {
      owner = { name, scope, hidden: hidden.has(scope), repositories: [] };
      owners.set(scope, owner);
    }
    return owner;
  };
  const addRepository = (fullName: string): void => {
    const owner = addOwner(ownerOf(fullName));
    const scope = fullName.toLowerCase();
    if (!owner.repositories.some((repository) => repository.scope === scope)) {
      owner.repositories.push({ name: fullName, scope, hidden: hidden.has(scope) });
    }
  };

  for (const section of SECTIONS) {
    overview[section].forEach((item) => addRepository(item.repository));
  }
  for (const scope of hidden) {
    if (scope.includes('/')) {
      addRepository(scope);
    } else {
      addOwner(scope);
    }
  }

  const byName = (a: { scope: string }, b: { scope: string }) => a.scope.localeCompare(b.scope);
  return [...owners.values()]
    .map((owner) => ({ ...owner, repositories: [...owner.repositories].sort(byName) }))
    .sort(byName);
}

/** Hide the scope if it is shown, show it if it is hidden. */
export function toggleScope(hidden: readonly string[], scope: string): string[] {
  return hidden.includes(scope)
    ? hidden.filter((entry) => entry !== scope)
    : [...hidden, scope].sort();
}

function ownerOf(repository: string): string {
  return repository.split('/')[0];
}
