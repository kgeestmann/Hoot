import { IconName } from '../../icons';
import { ListName, ListSort } from '../../services/lists';

/** A list's own page: where it lives, how the sidebar shows it, what it says when empty. */
export interface ListPageConfig {
  path: string;
  list: ListName;
  title: string;
  /** What one of its items is, e.g. in the overview's latest activity. */
  itemLabel: string;
  icon: IconName;
  emptyText: string;
}

/** The four list pages, in sidebar order; the routes and the sidenav are built from this. */
export const LIST_PAGES: readonly ListPageConfig[] = [
  {
    path: 'pull-requests',
    list: 'pull_requests',
    title: 'Pull requests',
    itemLabel: 'By you',
    icon: 'merge',
    emptyText: 'You have no open pull requests.',
  },
  {
    path: 'review-requests',
    list: 'review_requests',
    title: 'Review requests',
    itemLabel: 'Review request',
    icon: 'rate_review',
    emptyText: 'No reviews are waiting on you.',
  },
  {
    path: 'assigned',
    list: 'assigned_issues',
    title: 'Assigned issues',
    itemLabel: 'Assigned to you',
    icon: 'assignment_ind',
    emptyText: 'No open issues are assigned to you.',
  },
  {
    path: 'mentions',
    list: 'mentions',
    title: 'Mentions',
    itemLabel: 'Mention',
    icon: 'alternate_email',
    emptyText: 'Nobody mentioned you in an open issue or pull request.',
  },
];

export const SORT_OPTIONS: readonly { value: ListSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'created', label: 'Recently created' },
];
