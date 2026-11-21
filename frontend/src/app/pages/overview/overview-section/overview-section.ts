import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';

import { OverviewItem } from '../../../services/overview';
import { OverviewItemComponent } from '../overview-item/overview-item';

/** One list (e.g. review requests) with its items or an empty message. */
@Component({
  selector: 'app-overview-section',
  imports: [MatButtonModule, OverviewItemComponent],
  templateUrl: './overview-section.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview-section.css',
})
export class OverviewSection {
  readonly heading = input.required<string>();
  readonly items = input.required<readonly OverviewItem[]>();
  readonly emptyText = input.required<string>();
  /** All matches when `items` holds only some of them; defaults to the number of items. */
  readonly total = input<number>();
  /** Where to see every match, shown when there are more than `items`. */
  readonly moreUrl = input<string>();

  readonly count = computed(() => this.total() ?? this.items().length);
  readonly hasMore = computed(() => !!this.moreUrl() && this.count() > this.items().length);
}
