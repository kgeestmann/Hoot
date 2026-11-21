import { TestBed } from '@angular/core/testing';

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

  async function render(item: OverviewItem | PullRequestItem) {
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
  });

  it('shows no chips for an issue', async () => {
    const element = await render(issue);

    expect(element.querySelector('.statuses')).toBeNull();
  });
});
