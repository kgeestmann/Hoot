import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import { OverviewItem } from '../../../services/overview';
import { hasChips, ItemChips } from '../item/item-chips';
import { ItemMeta } from '../item/item-meta';

/** One list (e.g. review requests) with its items or an empty message. */
@Component({
  selector: 'app-overview-section',
  imports: [ItemChips, ItemMeta, MatButtonModule, MatDividerModule, MatIconModule, MatListModule],
  templateUrl: './overview-section.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview-section.css',
})
export class OverviewSection {
  /** Shown above the list; tabs name their list themselves and leave it out. */
  readonly heading = input<string>();
  readonly items = input.required<readonly OverviewItem[]>();
  readonly emptyText = input.required<string>();
  /** All matches when `items` holds only some of them; defaults to the number of items. */
  readonly total = input<number>();
  /** Where to see every match, shown when there are more than `items`. */
  readonly moreUrl = input<string>();

  readonly count = computed(() => this.total() ?? this.items().length);
  /** The items with what their list row needs: a third line only when there are chips. */
  readonly rows = computed(() => this.items().map((item) => ({ item, hasChips: hasChips(item) })));
  readonly hasMore = computed(() => !!this.moreUrl() && this.count() > this.items().length);
}
