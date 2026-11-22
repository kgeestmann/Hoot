import { Overview, OverviewItem } from '../../../services/overview';
import { OverviewFilters } from '../../../services/overview-filters';

/** A repository in the filter menu; `scope` is its lowercase "owner/name". */
export interface RepositoryOption {
  name: string;
  scope: string;
  hidden: boolean;
}

/** An owner (user or organization) in the filter menu with its repositories. */
export interface OwnerOption {
  name: string;
  scope: string;
  hidden: boolean;
  repositories: RepositoryOption[];
}

/** A label in the filter menu; `key` is its lowercase name. */
export interface LabelOption {
  name: string;
  key: string;
  /** GitHub's colour, six hex digits; grey for picked labels no item carries any more. */
  color: string;
  picked: boolean;
}

export interface FilterOptions {
  owners: OwnerOption[];
  labels: LabelOption[];
}

export const SECTIONS = [
  'pull_requests',
  'review_requests',
  'assigned_issues',
  'mentions',
] as const;

/** Tell whether the item's owner or repository is hidden; GitHub names are case-insensitive. */
export function isHidden(item: OverviewItem, hidden: ReadonlySet<string>): boolean {
  const repository = item.repository.toLowerCase();
  return hidden.has(repository) || hidden.has(ownerOf(repository));
}

/** Tell whether the item carries one of the picked labels; with none picked, every item does. */
export function hasPickedLabel(item: OverviewItem, picked: ReadonlySet<string>): boolean {
  return picked.size === 0 || item.labels.some((label) => picked.has(label.name.toLowerCase()));
}

/** The overview without the items the filters leave out. */
export function applyFilters(overview: Overview, filters: OverviewFilters): Overview {
  const hidden = new Set(filters.hidden);
  const picked = new Set(filters.labels);
  const shows = (item: OverviewItem) => !isHidden(item, hidden) && hasPickedLabel(item, picked);
  return {
    pull_requests: overview.pull_requests.filter(shows),
    review_requests: overview.review_requests.filter(shows),
    assigned_issues: overview.assigned_issues.filter(shows),
    mentions: overview.mentions.filter(shows),
  };
}

export function countItems(overview: Overview): number {
  return SECTIONS.reduce((total, section) => total + overview[section].length, 0);
}

/**
 * The owners, repositories and labels to offer in the filter menus, sorted by name: those in
 * the overview, plus filtered ones that no longer appear, so they can still be switched off.
 */
export function filterOptions(overview: Overview, filters: OverviewFilters): FilterOptions {
  const items = SECTIONS.flatMap((section) => overview[section]);
  return {
    owners: ownerOptions(items, new Set(filters.hidden)),
    labels: labelOptions(items, new Set(filters.labels)),
  };
}

/** Add the entry if it's missing, remove it if it's there; the result stays sorted. */
export function toggleEntry(entries: readonly string[], entry: string): string[] {
  return entries.includes(entry)
    ? entries.filter((existing) => existing !== entry)
    : [...entries, entry].sort();
}

function ownerOptions(items: OverviewItem[], hidden: ReadonlySet<string>): OwnerOption[] {
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

  items.forEach((item) => addRepository(item.repository));
  for (const scope of hidden) {
    if (scope.includes('/')) {
      addRepository(scope);
    } else {
      addOwner(scope);
    }
  }

  return [...owners.values()]
    .map((owner) => ({ ...owner, repositories: [...owner.repositories].sort(byScope) }))
    .sort(byScope);
}

function labelOptions(items: OverviewItem[], picked: ReadonlySet<string>): LabelOption[] {
  const labels = new Map<string, LabelOption>();
  for (const label of items.flatMap((item) => item.labels)) {
    const key = label.name.toLowerCase();
    if (!labels.has(key)) {
      labels.set(key, { name: label.name, key, color: label.color, picked: picked.has(key) });
    }
  }
  for (const key of picked) {
    if (!labels.has(key)) {
      labels.set(key, { name: key, key, color: 'ededed', picked: true });
    }
  }
  return [...labels.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function byScope(a: { scope: string }, b: { scope: string }): number {
  return a.scope.localeCompare(b.scope);
}

function ownerOf(repository: string): string {
  return repository.split('/')[0];
}
