import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TeamItem } from '../../../services/organizations';
import { OverviewItem } from '../../../services/overview';
import { relativeTime } from './relative-time';

/** The line under an item's title: kind, repo#number, age, and for team items the people. */
@Component({
  selector: 'app-item-meta',
  template: `{{ kindLabel() }} · {{ item().repository }}#{{ item().number }}
    @if (team(); as team) {
      · opened
      <time [attr.datetime]="team.createdAt" [title]="team.createdAt">{{ team.openedAgo }}</time>
      by {{ team.author }}
    }
    · updated
    <time [attr.datetime]="item().updated_at" [title]="item().updated_at">{{ updatedAgo() }}</time>
    @if (team(); as team) {
      · assigned to {{ team.assignees }}
    } `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ItemMeta {
  readonly item = input.required<OverviewItem | TeamItem>();

  readonly kindLabel = computed(() => (this.item().kind === 'issue' ? 'Issue' : 'Pull request'));
  readonly updatedAgo = computed(() => relativeTime(new Date(this.item().updated_at)));
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
