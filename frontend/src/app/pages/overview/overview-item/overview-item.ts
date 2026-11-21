import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { OverviewItem, PullRequestItem } from '../../../services/overview';
import { relativeTime } from './relative-time';
import { statusChips } from './status-chips';

/** One issue or pull request: title linking to GitHub, where it lives, when it changed. */
@Component({
  selector: 'app-overview-item',
  templateUrl: './overview-item.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview-item.css',
})
export class OverviewItemComponent {
  readonly item = input.required<OverviewItem | PullRequestItem>();

  readonly kindLabel = computed(() => (this.item().kind === 'issue' ? 'Issue' : 'Pull request'));
  readonly updatedAgo = computed(() => relativeTime(new Date(this.item().updated_at)));
  readonly statuses = computed(() => statusChips(this.item()));
}
