import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { OverviewItem } from '../../../services/overview';
import { ItemActions } from './item-actions';
import { ItemStateStore } from './item-state-store';

const ISSUE: OverviewItem = {
  kind: 'issue',
  title: 'Login button does nothing',
  repository: 'octo/hoot',
  number: 12,
  url: 'https://github.com/octo/hoot/issues/12',
  updated_at: '2026-11-22T10:00:00Z',
  labels: [],
  comment_count: 0,
  milestone: null,
};

describe('ItemActions', () => {
  let calls: [string, string, Date?][];

  /** Let the snack bar load and show, as it loads on first use. */
  async function settle(fixture: ComponentFixture<ItemActions>): Promise<void> {
    await import('./item-feedback');
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function snackBar(): HTMLElement | null {
    return document.querySelector('.mat-mdc-snack-bar-container');
  }

  async function render(): Promise<ComponentFixture<ItemActions>> {
    calls = [];
    await TestBed.configureTestingModule({
      imports: [ItemActions],
      providers: [
        {
          provide: ItemStateStore,
          useValue: {
            markDone: (item: OverviewItem) => {
              calls.push(['done', item.url]);
              return of(undefined);
            },
            snooze: (item: OverviewItem, until: Date) => {
              calls.push(['snooze', item.url, until]);
              return of(undefined);
            },
            restore: (item: OverviewItem) => {
              calls.push(['restore', item.url]);
              return of(undefined);
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ItemActions);
    fixture.componentRef.setInput('item', ISSUE);
    await fixture.whenStable();
    return fixture;
  }

  function menuItems(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button'));
  }

  async function open(fixture: ComponentFixture<ItemActions>, ...path: string[]): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    for (const label of path) {
      menuItems()
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await fixture.whenStable();
    }
  }

  it('names the item it acts on', async () => {
    const fixture = await render();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(trigger.getAttribute('aria-label')).toBe('Actions for Login button does nothing');
  });

  it('offers done and snooze', async () => {
    const fixture = await render();

    await open(fixture);

    expect(menuItems().map((button) => button.textContent?.trim())).toEqual([
      'Mark as done',
      'Snooze',
    ]);
  });

  it('marks the item as done and confirms it with Undo', async () => {
    const fixture = await render();

    await open(fixture, 'Mark as done');
    await settle(fixture);

    expect(calls).toEqual([['done', ISSUE.url]]);
    expect(snackBar()?.textContent).toContain('Marked as done');
  });

  it('confirms even after the row is gone, and Undo brings the item back', async () => {
    const fixture = await render();

    await open(fixture, 'Mark as done');
    fixture.destroy();
    await settle(fixture);
    snackBar()!.querySelector<HTMLButtonElement>('button')!.click();

    expect(calls).toEqual([
      ['done', ISSUE.url],
      ['restore', ISSUE.url],
    ]);
  });

  it('snoozes the item until tomorrow morning', async () => {
    const fixture = await render();

    await open(fixture, 'Snooze', 'Tomorrow');
    await settle(fixture);

    const [[action, url, until]] = calls;
    expect([action, url]).toEqual(['snooze', ISSUE.url]);
    expect([until!.getHours(), until!.getMinutes()]).toEqual([9, 0]);
    expect(until!.getTime()).toBeGreaterThan(Date.now());
  });
});
