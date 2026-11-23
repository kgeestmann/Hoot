import { TestBed } from '@angular/core/testing';

import { OverviewItem, PullRequestItem } from '../../../services/overview';
import { hasChips, ItemChips } from './item-chips';

const ISSUE: OverviewItem = {
  kind: 'issue',
  title: 'Login button does nothing',
  repository: 'octo/hoot',
  number: 12,
  url: 'https://github.com/octo/hoot/issues/12',
  updated_at: '2026-11-21T10:00:00Z',
  labels: [],
  comment_count: 0,
  milestone: null,
};

const PULL_REQUEST: PullRequestItem = {
  ...ISSUE,
  kind: 'pull_request',
  ci_status: 'FAILURE',
  review_decision: 'APPROVED',
  draft: false,
  reviewers: [],
  checks: [],
};

describe('ItemChips', () => {
  async function render(item: OverviewItem | PullRequestItem) {
    await TestBed.configureTestingModule({ imports: [ItemChips] }).compileComponents();
    const fixture = TestBed.createComponent(ItemChips);
    fixture.componentRef.setInput('item', item);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function chips(element: HTMLElement): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('mat-chip'));
  }

  it('shows CI and review status as chips with icon, text and colour', async () => {
    const element = await render(PULL_REQUEST);

    const statuses = chips(element).filter((chip) => chip.classList.contains('status'));
    expect(statuses.map((chip) => chip.textContent!.trim())).toEqual(['CI failing', 'Approved']);
    expect(statuses.map((chip) => chip.classList.contains('status-danger'))).toEqual([true, false]);
    expect(
      statuses.map((chip) => chip.querySelector('mat-icon')?.getAttribute('data-mat-icon-name')),
    ).toEqual(['close', 'check']);
  });

  it("shows labels in GitHub's colour with readable text", async () => {
    const element = await render({
      ...ISSUE,
      labels: [
        { name: 'bug', color: 'd73a4a' },
        { name: 'documentation', color: 'a2eeef' },
      ],
    });

    const labels = chips(element).filter((chip) => chip.classList.contains('label'));
    expect(labels.map((chip) => chip.textContent!.trim())).toEqual(['bug', 'documentation']);
    expect(labels[0].style.getPropertyValue('--mat-chip-elevated-container-color')).toBe('#d73a4a');
    expect(labels[1].style.getPropertyValue('--mat-chip-label-text-color')).toBe(
      'var(--hoot-on-label-dark)',
    );
  });

  it('tells whether an item has any chips', () => {
    expect(hasChips(ISSUE)).toBe(false);
    expect(hasChips(PULL_REQUEST)).toBe(true);
    expect(hasChips({ ...ISSUE, labels: [{ name: 'bug', color: 'd73a4a' }] })).toBe(true);
  });
});
