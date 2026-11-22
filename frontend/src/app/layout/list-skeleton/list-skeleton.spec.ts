import { TestBed } from '@angular/core/testing';

import { ListSkeleton } from './list-skeleton';

describe('ListSkeleton', () => {
  it('shows placeholder tabs and rows, marked as loading for screen readers', async () => {
    await TestBed.configureTestingModule({ imports: [ListSkeleton] }).compileComponents();
    const fixture = TestBed.createComponent(ListSkeleton);
    fixture.componentRef.setInput('label', 'Loading your overview');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const skeleton = element.querySelector('[aria-busy="true"]');
    expect(skeleton?.getAttribute('aria-label')).toBe('Loading your overview');
    expect(element.querySelectorAll('.skeleton-tab').length).toBe(4);
    expect(element.querySelectorAll('.skeleton-row').length).toBe(5);
  });
});
