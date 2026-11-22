import { Overview, OverviewItem } from '../../../services/overview';
import { applyFilters, countItems, filterOptions, isHidden, toggleScope } from './filtering';

function item(repository: string, number = 1): OverviewItem {
  return {
    kind: 'issue',
    title: `Issue ${number}`,
    repository,
    number,
    url: `https://github.com/${repository}/issues/${number}`,
    updated_at: '2026-11-21T10:00:00Z',
    labels: [],
  };
}

const OVERVIEW: Overview = {
  pull_requests: [],
  review_requests: [item('Octo-Org/hoot', 2)],
  assigned_issues: [item('dipt-pa1469-ht26/team-14', 3), item('kgeestmann/hoot', 4)],
  mentions: [item('kgeestmann/old-repo', 5)],
};

describe('isHidden', () => {
  it('hides items of a hidden owner, ignoring case', () => {
    expect(isHidden(item('Octo-Org/hoot'), new Set(['octo-org']))).toBe(true);
  });

  it('hides items of a hidden repository, ignoring case', () => {
    expect(isHidden(item('Octo-Org/Hoot'), new Set(['octo-org/hoot']))).toBe(true);
  });

  it('does not hide other repositories of the same owner', () => {
    expect(isHidden(item('octo-org/other'), new Set(['octo-org/hoot']))).toBe(false);
  });

  it('does not match owners by prefix', () => {
    expect(isHidden(item('octo-organization/hoot'), new Set(['octo-org']))).toBe(false);
  });
});

describe('applyFilters', () => {
  it('removes hidden items from every section', () => {
    const visible = applyFilters(OVERVIEW, new Set(['dipt-pa1469-ht26', 'kgeestmann/old-repo']));

    expect(visible.assigned_issues.map((entry) => entry.number)).toEqual([4]);
    expect(visible.mentions).toEqual([]);
    expect(visible.review_requests.map((entry) => entry.number)).toEqual([2]);
    expect(countItems(visible)).toBe(2);
  });

  it('keeps everything without filters', () => {
    expect(applyFilters(OVERVIEW, new Set())).toEqual(OVERVIEW);
  });
});

describe('filterOptions', () => {
  it('lists owners with their repositories, sorted, with their hidden state', () => {
    const options = filterOptions(OVERVIEW, new Set(['kgeestmann/old-repo']));

    expect(options.map((owner) => [owner.name, owner.hidden])).toEqual([
      ['dipt-pa1469-ht26', false],
      ['kgeestmann', false],
      ['Octo-Org', false],
    ]);
    expect(options[1].repositories).toEqual([
      { name: 'kgeestmann/hoot', scope: 'kgeestmann/hoot', hidden: false },
      { name: 'kgeestmann/old-repo', scope: 'kgeestmann/old-repo', hidden: true },
    ]);
    expect(options[2].scope).toBe('octo-org');
  });

  it('keeps hidden owners and repositories without items, so they can be shown again', () => {
    const options = filterOptions(OVERVIEW, new Set(['gone-org', 'kgeestmann/archived']));

    const gone = options.find((owner) => owner.scope === 'gone-org');
    expect(gone).toEqual({ name: 'gone-org', scope: 'gone-org', hidden: true, repositories: [] });
    const kgeestmann = options.find((owner) => owner.scope === 'kgeestmann')!;
    expect(kgeestmann.repositories.map((repository) => repository.scope)).toContain(
      'kgeestmann/archived',
    );
  });

  it('lists a repository once even if it appears in several sections', () => {
    const overview = { ...OVERVIEW, mentions: [item('kgeestmann/hoot', 9)] };

    const kgeestmann = filterOptions(overview, new Set()).find(
      (owner) => owner.scope === 'kgeestmann',
    )!;

    expect(kgeestmann.repositories.map((repository) => repository.scope)).toEqual([
      'kgeestmann/hoot',
    ]);
  });
});

describe('toggleScope', () => {
  it('hides a shown scope, keeping the list sorted', () => {
    expect(toggleScope(['octo-org'], 'kgeestmann/hoot')).toEqual(['kgeestmann/hoot', 'octo-org']);
  });

  it('shows a hidden scope again', () => {
    expect(toggleScope(['kgeestmann/hoot', 'octo-org'], 'octo-org')).toEqual(['kgeestmann/hoot']);
  });
});
