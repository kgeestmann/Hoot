import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverviewItem } from '../../../services/overview';
import { firstTabWithItems, ListTab, ListTabs } from './list-tabs';

function item(number: number): OverviewItem {
  return {
    kind: 'issue',
    title: `Issue ${number}`,
    repository: 'octo/hoot',
    number,
    url: `https://github.com/octo/hoot/issues/${number}`,
    updated_at: '2026-11-21T10:00:00Z',
    labels: [],
    comment_count: 0,
    milestone: null,
  };
}

const TABS: ListTab[] = [
  { label: 'Empty', count: 0, items: [], emptyText: 'Nothing here.' },
  {
    label: 'Some',
    count: 30,
    items: [item(1), item(2)],
    emptyText: 'Nothing here.',
    moreUrl: 'https://github.com/search?q=x',
  },
];

describe('ListTabs', () => {
  let fixture: ComponentFixture<ListTabs>;

  async function render(selectedIndex: number) {
    await TestBed.configureTestingModule({ imports: [ListTabs] }).compileComponents();
    fixture = TestBed.createComponent(ListTabs);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('selectedIndex', selectedIndex);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('names each tab with its count', async () => {
    const element = await render(0);

    const tabs = Array.from(element.querySelectorAll('[role="tab"]'));
    expect(
      tabs.map((tab) => [
        text(tab.querySelector('.tab-label')),
        text(tab.querySelector('.tab-count')),
      ]),
    ).toEqual([
      ['Empty', '0'],
      ['Some', '30'],
    ]);
  });

  it("shows the selected tab's list with a link to the rest", async () => {
    const element = await render(1);

    expect(element.querySelectorAll('a.item').length).toBe(2);
    expect(text(element.querySelector('.more-link'))).toBe('Show all 30 on GitHub');
  });

  it('reports a tab the user switches to', async () => {
    const element = await render(1);

    element.querySelector<HTMLElement>('[role="tab"]')!.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selectedIndex()).toBe(0);
    expect(text(element.querySelector('.empty'))).toBe('Nothing here.');
  });

  it('starts on the first tab with items', () => {
    expect(firstTabWithItems(TABS)).toBe(1);
    expect(firstTabWithItems([TABS[0]])).toBe(0);
  });
});
