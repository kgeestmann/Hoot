import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverviewItem, PullRequestItem } from '../../../services/overview';
import { ItemPanels } from './item-panels';

const ISSUE: OverviewItem = {
  kind: 'issue',
  title: 'Login button does nothing',
  repository: 'octo/hoot',
  number: 12,
  url: 'https://github.com/octo/hoot/issues/12',
  updated_at: '2026-11-21T10:00:00Z',
  labels: [{ name: 'bug', color: 'd73a4a' }],
  comment_count: 1,
  milestone: 'v1.0',
};

const PULL_REQUEST: PullRequestItem = {
  ...ISSUE,
  kind: 'pull_request',
  title: 'Add the overview API',
  number: 13,
  url: 'https://github.com/octo/hoot/pull/13',
  labels: [],
  comment_count: 4,
  milestone: null,
  ci_status: 'FAILURE',
  review_decision: 'CHANGES_REQUESTED',
  draft: true,
  reviewers: [
    { name: 'alice', state: 'APPROVED' },
    { name: 'bob', state: 'CHANGES_REQUESTED' },
    { name: 'frontend-team', state: 'REQUESTED' },
  ],
  checks: [
    { name: 'backend', state: 'success', url: 'https://ci/1' },
    { name: 'lint', state: 'failure', url: null },
    { name: 'e2e', state: 'pending', url: null },
    { name: 'docs', state: 'neutral', url: null },
  ],
};

describe('ItemPanels', () => {
  let fixture: ComponentFixture<ItemPanels>;

  async function render(items: OverviewItem[]) {
    await TestBed.configureTestingModule({ imports: [ItemPanels] }).compileComponents();
    fixture = TestBed.createComponent(ItemPanels);
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  async function expand(element: HTMLElement, index: number): Promise<HTMLElement> {
    const panel = element.querySelectorAll<HTMLElement>('.panel')[index];
    panel.querySelector<HTMLElement>('mat-expansion-panel-header')!.click();
    await fixture.whenStable();
    return panel;
  }

  /** The panel's facts as "Label: value". */
  function facts(panel: HTMLElement): string[] {
    return Array.from(panel.querySelectorAll('.fact')).map(
      (fact) => `${text(fact.querySelector('dt'))}: ${text(fact.querySelector('dd'))}`,
    );
  }

  function states(panel: HTMLElement, group: string): string[] {
    const section = Array.from(panel.querySelectorAll('.group')).find(
      (candidate) => text(candidate.querySelector('.group-title')) === group,
    )!;
    return Array.from(section.querySelectorAll('.state')).map((state) =>
      [
        state.querySelector('mat-icon')?.getAttribute('data-mat-icon-name'),
        text(state.querySelector('.name')),
        text(state.querySelector('.state-text')),
      ].join(' '),
    );
  }

  it('shows each item collapsed, like an overview row', async () => {
    const element = await render([ISSUE, PULL_REQUEST]);

    const panels = Array.from(element.querySelectorAll('.panel'));
    expect(panels.map((panel) => text(panel.querySelector('.title')))).toEqual([
      'Login button does nothing',
      'Add the overview API',
    ]);
    expect(text(panels[1].querySelector('app-item-chips'))).toContain('Draft');
    expect(element.querySelector('app-item-details')).toBeNull();
  });

  it('shows comments, milestone and a link to GitHub when an issue is expanded', async () => {
    const element = await render([ISSUE]);

    const panel = await expand(element, 0);

    expect(facts(panel)).toEqual(['Comments: 1 comment', 'Milestone: v1.0']);
    expect(panel.querySelector('.group')).toBeNull();
    expect(panel.querySelector<HTMLAnchorElement>('.open-link')?.href).toBe(ISSUE.url);
  });

  it('shows draft state, reviewers and every check of a pull request', async () => {
    const element = await render([PULL_REQUEST]);

    const panel = await expand(element, 0);

    expect(facts(panel)).toEqual(['Comments: 4 comments', 'Milestone: None', 'State: Draft']);
    expect(states(panel, 'Reviewers')).toEqual([
      'check alice approved',
      'close bob changes requested',
      'schedule frontend-team review requested',
    ]);
    expect(states(panel, 'Checks')).toEqual([
      'check backend passed',
      'close lint failed',
      'schedule e2e running',
      'do_not_disturb_on docs skipped',
    ]);
    expect(panel.querySelector<HTMLAnchorElement>('.state a.name')?.href).toBe('https://ci/1');
  });

  it('says so when a pull request has no reviewers or checks yet', async () => {
    const unreviewed: PullRequestItem = { ...PULL_REQUEST, reviewers: [], checks: [] };
    const element = await render([unreviewed]);

    const panel = await expand(element, 0);

    expect(Array.from(panel.querySelectorAll('.none')).map(text)).toEqual([
      'Nobody is reviewing yet.',
      'No checks on the last commit.',
    ]);
  });
});
