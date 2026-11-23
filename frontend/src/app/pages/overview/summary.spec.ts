import { Overview, OverviewItem } from '../../services/overview';
import { NO_FILTERS } from '../../services/overview-filters';
import { summarize } from './summary';

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

  it('keeps the three newest items', () => {
    const assigned = summarize(OVERVIEW, NO_FILTERS)[2];

    expect(assigned.newest.map((entry) => entry.number)).toEqual([1, 2, 3]);
  });

  it('says when the filters hide everything in a list', () => {
    const mentions = summarize(OVERVIEW, { hidden: ['kg'], labels: [] })[3];

    expect(mentions.emptyText).toBe('All 1 hidden by your filters.');
  });
});
