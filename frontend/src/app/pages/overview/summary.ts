import { Overview, OverviewItem } from '../../services/overview';
import { OverviewFilters } from '../../services/overview-filters';
import { ListPageConfig, LIST_PAGES } from '../list/list-pages';
import { filterItems } from './filters/filtering';

/** How many items the latest activity shows. */
export const LATEST_ITEMS = 8;

/** An item in the latest activity, with the list it comes from. */
export interface LatestItem {
  item: OverviewItem;
  page: ListPageConfig;
}

/** One list as the overview's tiles and the sidebar count it. */
export interface ListSummary {
  page: ListPageConfig;
  /** What the filters let through, e.g. "4", or "50+" when GitHub cut the list off. */
  count: string;
}

/** Count each list page's list from the overview, after the filters. */
export function summarize(overview: Overview, filters: OverviewFilters): ListSummary[] {
  return LIST_PAGES.map((page) => {
    const shown = filterItems(overview[page.list], filters).length;
    return { page, count: overview.totals[page.list].has_more ? `${shown}+` : `${shown}` };
  });
}

/**
 * The most recently updated items across all lists, after the filters. An item in several lists
 * shows once, with the first of them in sidebar order.
 */
export function latest(overview: Overview, filters: OverviewFilters): LatestItem[] {
  const entries = LIST_PAGES.flatMap((page) =>
    filterItems(overview[page.list], filters).map((item) => ({ item, page })),
  );
  // Array.sort is stable, so items updated at the same moment keep the sidebar order.
  entries.sort((a, b) => b.item.updated_at.localeCompare(a.item.updated_at));
  const seen = new Set<string>();
  return entries
    .filter((entry) => !seen.has(entry.item.url) && seen.add(entry.item.url))
    .slice(0, LATEST_ITEMS);
}
