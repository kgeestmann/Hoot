import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ItemActions } from '../../overview/item-state/item-actions';
import { IconName } from '../../../icons';
import { Check, OverviewItem, PullRequestItem } from '../../../services/overview';

/** How a reviewer's or check's state reads: always words and an icon, never colour alone. */
interface StateView {
  text: string;
  icon: IconName;
  tone: 'success' | 'danger' | 'neutral';
}

const REVIEWER_STATES: Record<string, StateView> = {
  APPROVED: { text: 'approved', icon: 'check', tone: 'success' },
  CHANGES_REQUESTED: { text: 'changes requested', icon: 'close', tone: 'danger' },
  REQUESTED: { text: 'review requested', icon: 'schedule', tone: 'neutral' },
  COMMENTED: { text: 'commented', icon: 'chat_bubble', tone: 'neutral' },
  DISMISSED: { text: 'dismissed', icon: 'do_not_disturb_on', tone: 'neutral' },
  PENDING: { text: 'review in progress', icon: 'schedule', tone: 'neutral' },
};

const CHECK_STATES: Record<Check['state'], StateView> = {
  success: { text: 'passed', icon: 'check', tone: 'success' },
  failure: { text: 'failed', icon: 'close', tone: 'danger' },
  pending: { text: 'running', icon: 'schedule', tone: 'neutral' },
  neutral: { text: 'skipped', icon: 'do_not_disturb_on', tone: 'neutral' },
};

/** The details of an item, shown when its entry on a list page is expanded. */
@Component({
  selector: 'app-item-details',
  imports: [ItemActions, MatButtonModule, MatIconModule],
  templateUrl: './item-details.html',
  styleUrl: './item-details.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ItemDetails {
  readonly item = input.required<OverviewItem | PullRequestItem>();

  /** Pull request details; `undefined` for issues. */
  readonly pullRequest = computed(() => {
    const item = this.item();
    return 'reviewers' in item ? item : undefined;
  });
  readonly reviewers = computed(() =>
    (this.pullRequest()?.reviewers ?? []).map((reviewer) => ({
      name: reviewer.name,
      ...(REVIEWER_STATES[reviewer.state] ?? {
        text: reviewer.state.toLowerCase(),
        icon: 'schedule',
        tone: 'neutral',
      }),
    })),
  );
  readonly checks = computed(() =>
    (this.pullRequest()?.checks ?? []).map((check) => ({ ...check, ...CHECK_STATES[check.state] })),
  );
  readonly commentText = computed(() => {
    const count = this.item().comment_count;
    return count === 1 ? '1 comment' : `${count} comments`;
  });
}
