import { Overview, OverviewItem } from '../../../services/overview';
import { NO_FILTERS } from '../../../services/overview-filters';
import {
  applyFilters,
  countItems,
  filterItems,
  filterOptions,
  filterOptionsFor,
  hasPickedLabel,
  isHidden,
  toggleEntry,
} from './filtering';

function item(repository: string, number = 1, labels: string[] = []): OverviewItem {
  return {
    kind: 'issue',
    title: `Issue ${number}`,
    repository,
    number,
    url: `https://github.com/${repository}/issues/${number}`,
    updated_at: '2026-11-21T10:00:00Z',
    labels: labels.map((name) => ({ name, color: 'd73a4a' })),
  };
}

const ALL_LOADED = { total: 0, has_more: false, search_url: '' };
const NO_MORE: Overview['totals'] = {
  assigned_issues: ALL_LOADED,
  pull_requests: ALL_LOADED,
  review_requests: ALL_LOADED,
  mentions: ALL_LOADED,
};

const OVERVIEW: Overview = {
  pull_requests: [],
  review_requests: [item('Octo-Org/hoot', 2, ['Bug'])],
  assigned_issues: [item('dipt-pa1469-ht26/team-14', 3), item('kgeestmann/hoot', 4, ['frontend'])],
  mentions: [item('kgeestmann/old-repo', 5, ['bug'])],
  totals: NO_MORE,
};

describe('isHidden', () => {
  it('hides items of a hidden owner or repository, ignoring case', () => {
    expect(isHidden(item('Octo-Org/hoot'), new Set(['octo-org']))).toBe(true);
    expect(isHidden(item('Octo-Org/Hoot'), new Set(['octo-org/hoot']))).toBe(true);
  });

  it('does not hide other repositories or owners with the same prefix', () => {
    expect(isHidden(item('octo-org/other'), new Set(['octo-org/hoot']))).toBe(false);
    expect(isHidden(item('octo-organization/hoot'), new Set(['octo-org']))).toBe(false);
  });
});

describe('hasPickedLabel', () => {
  it('lets every item through when no label is picked', () => {
    expect(hasPickedLabel(item('octo/hoot'), new Set())).toBe(true);
  });

  it('lets only items with a picked label through, ignoring case', () => {
    expect(hasPickedLabel(item('octo/hoot', 1, ['Bug']), new Set(['bug']))).toBe(true);
    expect(hasPickedLabel(item('octo/hoot', 1, ['docs']), new Set(['bug']))).toBe(false);
    expect(hasPickedLabel(item('octo/hoot'), new Set(['bug']))).toBe(false);
  });
});

describe('applyFilters', () => {
  it('removes items of hidden owners and repositories from every list', () => {
    const visible = applyFilters(OVERVIEW, {
      hidden: ['dipt-pa1469-ht26', 'kgeestmann/old-repo'],
      labels: [],
    });

    expect(visible.assigned_issues.map((entry) => entry.number)).toEqual([4]);
    expect(visible.mentions).toEqual([]);
    expect(countItems(visible)).toBe(2);
  });

  it('keeps only items with a picked label', () => {
    const visible = applyFilters(OVERVIEW, { hidden: [], labels: ['bug'] });

    expect(visible.review_requests.map((entry) => entry.number)).toEqual([2]);
    expect(visible.assigned_issues).toEqual([]);
    expect(visible.mentions.map((entry) => entry.number)).toEqual([5]);
  });

  it('keeps everything without filters', () => {
    expect(applyFilters(OVERVIEW, NO_FILTERS)).toEqual(OVERVIEW);
  });
});

describe('filterOptions', () => {
  it('lists owners with their repositories, sorted, with their hidden state', () => {
    const { owners } = filterOptions(OVERVIEW, { hidden: ['kgeestmann/old-repo'], labels: [] });

    expect(owners.map((owner) => [owner.name, owner.hidden])).toEqual([
      ['dipt-pa1469-ht26', false],
      ['kgeestmann', false],
      ['Octo-Org', false],
    ]);
    expect(owners[1].repositories).toEqual([
      { name: 'kgeestmann/hoot', scope: 'kgeestmann/hoot', hidden: false },
      { name: 'kgeestmann/old-repo', scope: 'kgeestmann/old-repo', hidden: true },
    ]);
  });

  it('keeps hidden owners and repositories without items, so they can be shown again', () => {
    const { owners } = filterOptions(OVERVIEW, {
      hidden: ['gone-org', 'kgeestmann/archived'],
      labels: [],
    });

    expect(owners.find((owner) => owner.scope === 'gone-org')?.hidden).toBe(true);
    const kgeestmann = owners.find((owner) => owner.scope === 'kgeestmann')!;
    expect(kgeestmann.repositories.map((repository) => repository.scope)).toContain(
      'kgeestmann/archived',
    );
  });

  it('lists every label once, sorted, with its colour and picked state', () => {
    const { labels } = filterOptions(OVERVIEW, { hidden: [], labels: ['bug'] });

    expect(labels).toEqual([
      { name: 'Bug', key: 'bug', color: 'd73a4a', picked: true },
      { name: 'frontend', key: 'frontend', color: 'd73a4a', picked: false },
    ]);
  });

  it('keeps picked labels that no item carries any more, so they can be unpicked', () => {
    const { labels } = filterOptions(OVERVIEW, { hidden: [], labels: ['wontfix'] });

    expect(labels.find((label) => label.key === 'wontfix')).toEqual({
      name: 'wontfix',
      key: 'wontfix',
      color: 'ededed',
      picked: true,
    });
  });
});

describe('toggleEntry', () => {
  it('adds a missing entry, keeping the list sorted', () => {
    expect(toggleEntry(['octo-org'], 'kgeestmann/hoot')).toEqual(['kgeestmann/hoot', 'octo-org']);
  });

  it('removes an entry that is there', () => {
    expect(toggleEntry(['kgeestmann/hoot', 'octo-org'], 'octo-org')).toEqual(['kgeestmann/hoot']);
  });
});

describe('filterItems', () => {
  it('filters a single list by owner, repository and label, keeping the order', () => {
    const items = [
      item('octo/hoot', 1, ['bug']),
      item('octo/other', 2, ['bug']),
      item('kg/hoot', 3),
    ];

    expect(
      filterItems(items, { hidden: ['octo/other'], labels: ['bug'] }).map((entry) => entry.number),
    ).toEqual([1]);
  });
});

describe('filterOptionsFor', () => {
  it('offers the owners and labels of a single list', () => {
    const options = filterOptionsFor([item('octo/hoot', 1, ['bug'])], NO_FILTERS);

    expect(options.owners.map((owner) => owner.scope)).toEqual(['octo']);
    expect(options.labels.map((label) => label.key)).toEqual(['bug']);
  });
});
