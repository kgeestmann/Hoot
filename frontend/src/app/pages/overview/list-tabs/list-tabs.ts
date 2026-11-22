import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';

import { OverviewItem } from '../../../services/overview';
import { OverviewSection } from '../overview-section/overview-section';

/** One tab: a named list of items with its count. */
export interface ListTab {
  label: string;
  /** Shown next to the label; can be more than `items` when only some were loaded. */
  count: number;
  items: readonly OverviewItem[];
  emptyText: string;
  /** How many there are on GitHub, if that differs from `count`. */
  total?: number;
  /** The full list on GitHub, linked when there are more than `items`. */
  moreUrl?: string;
}

/** Lists as Material tabs with counts; the overview and the team view share it. */
@Component({
  selector: 'app-list-tabs',
  imports: [MatTabsModule, OverviewSection],
  templateUrl: './list-tabs.html',
  styleUrl: './list-tabs.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ListTabs {
  readonly tabs = input.required<ListTab[]>();
  readonly selectedIndex = model(0);
}

/** The index of the first tab with something in it, so a page opens where the work is. */
export function firstTabWithItems(tabs: ListTab[]): number {
  return Math.max(
    tabs.findIndex((tab) => tab.count > 0),
    0,
  );
}
