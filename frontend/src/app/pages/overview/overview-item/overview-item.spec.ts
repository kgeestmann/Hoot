import { TestBed } from '@angular/core/testing';

import { TeamItem } from '../../../services/organizations';
import { OverviewItem, PullRequestItem } from '../../../services/overview';
import { OverviewItemComponent } from './overview-item';

describe('OverviewItemComponent', () => {
  const issue: OverviewItem = {
    kind: 'issue',
    title: 'Login button does nothing',
    repository: 'octo/hoot',
    number: 12,
    url: 'https://github.com/octo/hoot/issues/12',
    updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  };

  async function render(item: OverviewItem | PullRequestItem | TeamItem) {
    await TestBed.configureTestingModule({ imports: [OverviewItemComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OverviewItemComponent);
    fixture.componentRef.setInput('item', item);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('links the title to GitHub', async () => {
    const element = await render(issue);

    const title = element.querySelector<HTMLAnchorElement>('.title');
    expect(text(title)).toBe('Login button does nothing');
    expect(title?.href).toBe('https://github.com/octo/hoot/issues/12');
  });

  it('shows kind, repository, number and when it was updated', async () => {
    const element = await render(issue);

    const parts = Array.from(element.querySelector('.meta')!.children).map(text);
    expect(parts).toEqual(['Issue', 'octo/hoot#12', 'updated 3 hours ago']);
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe(issue.updated_at);
  });

  it('shows CI and review status of a pull request as labelled chips', async () => {
    const element = await render({
      ...issue,
      kind: 'pull_request',
      ci_status: 'FAILURE',
      review_decision: 'APPROVED',
    });

    const chips = Array.from(element.querySelectorAll('.status'));
    expect(chips.map((chip) => [text(chip), chip.className])).toEqual([
      ['CI failing', 'status status-danger'],
      ['Approved', 'status status-success'],
    ]);
    expect(chips.map((chip) => chip.querySelector('path')?.getAttribute('d')?.slice(0, 8))).toEqual(
      ['m256-200', 'M382-240'],
    );
  });

  it('shows no chips for an issue', async () => {
    const element = await render(issue);

    expect(element.querySelector('.statuses')).toBeNull();
  });

  describe('in a team view', () => {
    const teamItem: TeamItem = {
      ...issue,
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      author: 'alice',
      assignees: ['bob', 'carol'],
      ci_status: null,
      review_decision: null,
    };

    it('shows when and by whom it was opened, and who is assigned', async () => {
      const element = await render(teamItem);

      const parts = Array.from(element.querySelector('.meta')!.children).map(text);
      expect(parts).toEqual([
        'Issue',
        'octo/hoot#12',
        'opened 6 days ago by alice',
        'updated 3 hours ago',
        'assigned to bob, carol',
      ]);
    });

    it('says so when nobody is assigned or the author was deleted', async () => {
      const element = await render({ ...teamItem, author: null, assignees: [] });

      expect(text(element.querySelector('.opened'))).toBe('opened 6 days ago by a deleted account');
      expect(text(element.querySelector('.assignees'))).toBe('assigned to nobody');
    });
  });
});
