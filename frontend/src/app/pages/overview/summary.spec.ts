import { Overview, OverviewItem } from '../../services/overview';
import { NO_FILTERS } from '../../services/overview-filters';
import { latest, LATEST_ITEMS, summarize } from './summary';

function item(repository: string, number: number): OverviewItem {
  return {
    kind: 'issue',
    title: `Issue ${number}`,
    repository,
    number,
    url: `https://github.com/${repository}/issues/${number}`,
    updated_at: '2026-11-21T10:00:00Z',
    labels: [],
    comment_count: 0,
    milestone: null,
  };
}

const ALL_LOADED = { total: 0, has_more: false, search_url: '' };
const OVERVIEW: Overview = {
  pull_requests: [],
  review_requests: [],
  assigned_issues: [1, 2, 3, 4].map((number) => item('octo/hoot', number)),
  mentions: [item('kg/hoot', 5)],
  totals: {
    pull_requests: ALL_LOADED,
    review_requests: ALL_LOADED,
    assigned_issues: { total: 90, has_more: true, search_url: '' },
    mentions: ALL_LOADED,
  },
};

describe('summarize', () => {
  it('summarises each list page in sidebar order', () => {
    expect(summarize(OVERVIEW, NO_FILTERS).map((summary) => summary.page.list)).toEqual([
      'pull_requests',
      'review_requests',
      'assigned_issues',
      'mentions',
    ]);
  });

  it('counts what the filters let through, with "+" for a list GitHub cut off', () => {
    const summaries = summarize(OVERVIEW, { hidden: ['octo/hoot'], labels: [] });

    expect(summaries.map((summary) => summary.count)).toEqual(['0', '0', '0+', '1']);
  });
});

describe('latest', () => {
  function at(item: OverviewItem, updatedAt: string): OverviewItem {
    return { ...item, updated_at: updatedAt };
  }

  it('lists the most recently updated items across all lists, with where they come from', () => {
    const overview: Overview = {
      ...OVERVIEW,
      assigned_issues: [at(item('octo/hoot', 1), '2026-11-21T08:00:00Z')],
      mentions: [at(item('kg/hoot', 5), '2026-11-21T09:00:00Z')],
    };

    expect(
      latest(overview, NO_FILTERS).map(({ item, page }) => [item.number, page.itemLabel]),
    ).toEqual([
      [5, 'Mention'],
      [1, 'Assigned to you'],
    ]);
  });

  it('shows an item in several lists once, with the first list in sidebar order', () => {
    const shared = item('octo/hoot', 1);
    const overview: Overview = { ...OVERVIEW, assigned_issues: [shared], mentions: [shared] };

    expect(latest(overview, NO_FILTERS).map(({ page }) => page.list)).toEqual(['assigned_issues']);
  });

  it(`keeps at most ${LATEST_ITEMS} items and applies the filters`, () => {
    const many = Array.from({ length: 12 }, (_, index) => item('octo/hoot', index + 1));

    expect(latest({ ...OVERVIEW, assigned_issues: many }, NO_FILTERS)).toHaveLength(LATEST_ITEMS);
    expect(
      latest(OVERVIEW, { hidden: ['octo'], labels: [] }).map(({ item }) => item.number),
    ).toEqual([5]);
  });
});
