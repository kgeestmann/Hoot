import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

import { OverviewItem, PullRequestItem } from '../../../services/overview';
import { labelColors } from './label-colors';
import { statusChips, TONE_ICONS } from './status-chips';

/** An item's CI and review status (icon + text + colour) followed by its GitHub labels. */
@Component({
  selector: 'app-item-chips',
  imports: [MatChipsModule, MatIconModule],
  templateUrl: './item-chips.html',
  styleUrl: './item-chips.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ItemChips {
  readonly item = input.required<OverviewItem | PullRequestItem>();

  readonly statuses = computed(() =>
    statusChips(this.item()).map((chip) => ({ ...chip, icon: chip.icon ?? TONE_ICONS[chip.tone] })),
  );
  readonly labels = computed(() =>
    this.item().labels.map((label) => ({ name: label.name, ...labelColors(label.color) })),
  );
}

/** Whether an item has anything for `app-item-chips` to show. */
export function hasChips(item: OverviewItem | PullRequestItem): boolean {
  return item.labels.length > 0 || statusChips(item).length > 0;
}
