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
    };
  }

  async function render(items: OverviewItem[]) {
    await TestBed.configureTestingModule({ imports: [OverviewSection] }).compileComponents();
    const fixture = TestBed.createComponent(OverviewSection);
    fixture.componentRef.setInput('heading', 'Assigned issues');
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('emptyText', 'No open issues are assigned to you.');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the heading with the number of items and lists them', async () => {
    const element = await render([item(1), item(2)]);

    expect(element.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Assigned issues 2',
    );
    expect(element.querySelectorAll('app-overview-item').length).toBe(2);
    expect(element.querySelector('.empty')).toBeNull();
  });

  it('shows the empty text when there are no items', async () => {
    const element = await render([]);

    expect(element.querySelector('.empty')?.textContent?.trim()).toBe(
      'No open issues are assigned to you.',
    );
    expect(element.querySelector('.items')).toBeNull();
  });
});
