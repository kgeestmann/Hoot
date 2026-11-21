import { IconName } from '../../../layout/icon/icon';
import { OverviewItem, PullRequestItem } from '../../../services/overview';

/** Colour role of a status chip; the label always says the same in words. */
export type StatusTone = 'success' | 'danger' | 'neutral';

/** The icon that goes with each colour role, so a chip never relies on colour alone (#55). */
export const TONE_ICONS: Record<StatusTone, IconName> = {
  success: 'check',
  danger: 'close',
  neutral: 'schedule',
};

export interface StatusChip {
  label: string;
  tone: StatusTone;
}

const CI_CHIPS: Record<string, StatusChip> = {
  SUCCESS: { label: 'CI passing', tone: 'success' },
  FAILURE: { label: 'CI failing', tone: 'danger' },
  ERROR: { label: 'CI failing', tone: 'danger' },
  PENDING: { label: 'CI running', tone: 'neutral' },
  EXPECTED: { label: 'CI running', tone: 'neutral' },
};

const REVIEW_CHIPS: Record<string, StatusChip> = {
  APPROVED: { label: 'Approved', tone: 'success' },
  CHANGES_REQUESTED: { label: 'Changes requested', tone: 'danger' },
  REVIEW_REQUIRED: { label: 'Review required', tone: 'neutral' },
};

/** The CI and review chips of a pull request; none for other items or unknown states. */
export function statusChips(item: OverviewItem | PullRequestItem): StatusChip[] {
  if (!('ci_status' in item)) {
    return [];
  }
  return [
    item.ci_status ? CI_CHIPS[item.ci_status] : undefined,
    item.review_decision ? REVIEW_CHIPS[item.review_decision] : undefined,
  ].filter((chip): chip is StatusChip => chip !== undefined);
}
