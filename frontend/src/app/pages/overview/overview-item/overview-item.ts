import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon } from '../../../layout/icon/icon';
import { TeamItem } from '../../../services/organizations';
import { OverviewItem, PullRequestItem } from '../../../services/overview';
import { relativeTime } from './relative-time';
import { statusChips, TONE_ICONS } from './status-chips';

/** One issue or pull request: title linking to GitHub, where it lives, when it changed. */
@Component({
  selector: 'app-overview-item',
  imports: [Icon],
  templateUrl: './overview-item.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview-item.css',
})
export class OverviewItemComponent {
  readonly item = input.required<OverviewItem | PullRequestItem | TeamItem>();
  readonly toneIcons = TONE_ICONS;

  readonly kindLabel = computed(() => (this.item().kind === 'issue' ? 'Issue' : 'Pull request'));
  readonly updatedAgo = computed(() => relativeTime(new Date(this.item().updated_at)));
  readonly statuses = computed(() => statusChips(this.item()));
  /** Who opened it and who is on it; only team items carry people. */
  readonly team = computed(() => {
    const item = this.item();
    if (!('created_at' in item)) {
      return undefined;
    }
    return {
      openedAgo: relativeTime(new Date(item.created_at)),
      createdAt: item.created_at,
      author: item.author ?? 'a deleted account',
      assignees: item.assignees.length > 0 ? item.assignees.join(', ') : 'nobody',
    };
  });
}
