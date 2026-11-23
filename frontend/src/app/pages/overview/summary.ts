import { Overview, OverviewItem } from '../../services/overview';
import { OverviewFilters } from '../../services/overview-filters';
import { ListPageConfig, LIST_PAGES } from '../list/list-pages';
import { filterItems } from './filters/filtering';

/** How many items a dashboard card shows. */
export const NEWEST_ITEMS = 3;

/** One list as the dashboard and the sidebar summarise it. */
export interface ListSummary {
  page: ListPageConfig;
  /** What the filters let through, e.g. "4", or "50+" when GitHub cut the list off. */
  count: string;
  /** The most recently updated items the filters let through. */
  newest: OverviewItem[];
  emptyText: string;
}

/** Summarise each list page's list from the overview, after the filters. */
export function summarize(overview: Overview, filters: OverviewFilters): ListSummary[] {
  return LIST_PAGES.map((page) => {
    const all = overview[page.list];
    const shown = filterItems(all, filters);
    const hidden = all.length - shown.length;
    return {
      page,
      count: overview.totals[page.list].has_more ? `${shown.length}+` : `${shown.length}`,
      newest: shown.slice(0, NEWEST_ITEMS),
      emptyText: hidden > 0 ? `All ${hidden} hidden by your filters.` : page.emptyText,
    };
  });
}
