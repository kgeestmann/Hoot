import { TestBed } from '@angular/core/testing';

import { OverviewItem } from '../../../services/overview';
import { OverviewSection } from './overview-section';

describe('OverviewSection', () => {
  function item(number: number): OverviewItem {
    return {
      kind: 'issue',
      title: `Issue ${number}`,
      repository: 'octo/hoot',
      number,
      url: `https://github.com/octo/hoot/issues/${number}`,
      updated_at: '2026-11-21T10:00:00Z',
      labels: [],
    };
  }

  async function render(items: OverviewItem[], total?: number, moreUrl?: string) {
    await TestBed.configureTestingModule({ imports: [OverviewSection] }).compileComponents();
    const fixture = TestBed.createComponent(OverviewSection);
    fixture.componentRef.setInput('heading', 'Assigned issues');
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('emptyText', 'No open issues are assigned to you.');
    if (total !== undefined) {
      fixture.componentRef.setInput('total', total);
    }
    if (moreUrl !== undefined) {
      fixture.componentRef.setInput('moreUrl', moreUrl);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the heading with the number of items and lists them', async () => {
    const element = await render([item(1), item(2)]);

    expect(element.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Assigned issues 2',
    );
    const rows = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.item'));
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      'https://github.com/octo/hoot/issues/1',
      'https://github.com/octo/hoot/issues/2',
    ]);
    expect(rows[0].querySelector('.title')?.textContent?.trim()).toBe('Issue 1');
    expect(element.querySelector('.empty')).toBeNull();
  });

  it('shows the empty text when there are no items', async () => {
    const element = await render([]);

    expect(element.querySelector('.empty')?.textContent?.trim()).toBe(
      'No open issues are assigned to you.',
    );
    expect(element.querySelector('.items')).toBeNull();
  });

  it('counts the total and links to the rest when only some items are loaded', async () => {
    const element = await render([item(1)], 42, 'https://github.com/search?q=x');

    expect(element.querySelector('.count')?.textContent?.trim()).toBe('42');
    const more = element.querySelector<HTMLAnchorElement>('.more-link');
    expect(more?.textContent?.trim()).toBe('Show all 42 on GitHub');
    expect(more?.href).toBe('https://github.com/search?q=x');
  });

  it('has no link to more when every item is loaded', async () => {
    const element = await render([item(1)], 1, 'https://github.com/search?q=x');

    expect(element.querySelector('.more-link')).toBeNull();
  });

  it('adds a line of chips only to items that have labels or a status', async () => {
    const element = await render([
      item(1),
      { ...item(2), labels: [{ name: 'bug', color: 'd73a4a' }] },
    ]);

    const rows = Array.from(element.querySelectorAll('a.item'));
    expect(rows.map((row) => row.querySelector('app-item-chips') !== null)).toEqual([false, true]);
  });
});
