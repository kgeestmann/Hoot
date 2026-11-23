import { TestBed } from '@angular/core/testing';

import { TeamItem } from '../../../services/organizations';
import { OverviewItem } from '../../../services/overview';
import { ItemMeta } from './item-meta';

const HOURS = 60 * 60 * 1000;

const ISSUE: OverviewItem = {
  kind: 'issue',
  title: 'Login button does nothing',
  repository: 'octo/hoot',
  number: 12,
  url: 'https://github.com/octo/hoot/issues/12',
  updated_at: new Date(Date.now() - 3 * HOURS).toISOString(),
  labels: [],
  comment_count: 0,
  milestone: null,
};

describe('ItemMeta', () => {
  async function render(item: OverviewItem | TeamItem) {
    await TestBed.configureTestingModule({ imports: [ItemMeta] }).compileComponents();
    const fixture = TestBed.createComponent(ItemMeta);
    fixture.componentRef.setInput('item', item);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: HTMLElement): string {
    return element.textContent!.replace(/\s+/g, ' ').trim();
  }

  it('shows kind, repository, number and when it was updated', async () => {
    const element = await render(ISSUE);

    expect(text(element)).toBe('Issue · octo/hoot#12 · updated 3 hours ago');
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe(ISSUE.updated_at);
  });

  it('starts right at the text, so it lines up with the title above', async () => {
    const element = await render(ISSUE);

    expect(element.textContent).toMatch(/^Issue/);
  });

  it('names pull requests as such', async () => {
    expect(text(await render({ ...ISSUE, kind: 'pull_request' }))).toContain('Pull request ·');
  });

  it('shows who opened a team item, when, and who is assigned', async () => {
    const element = await render({
      ...ISSUE,
      created_at: new Date(Date.now() - 6 * 24 * HOURS).toISOString(),
      author: 'alice',
      assignees: ['bob', 'carol'],
      ci_status: null,
      review_decision: null,
    });

    expect(text(element)).toBe(
      'Issue · octo/hoot#12 · opened 6 days ago by alice · updated 3 hours ago · assigned to bob, carol',
    );
  });

  it('says so when nobody is assigned or the author was deleted', async () => {
    const element = await render({
      ...ISSUE,
      created_at: ISSUE.updated_at,
      author: null,
      assignees: [],
      ci_status: null,
      review_decision: null,
    });

    expect(text(element)).toContain('by a deleted account');
    expect(text(element)).toContain('assigned to nobody');
  });
});
