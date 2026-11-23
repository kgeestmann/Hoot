import { GitHubAccess } from '../services/github-access';
import { ListName } from '../services/lists';
import { OrgOverview, TeamItem } from '../services/organizations';
import { Check, Label, OverviewItem, PullRequestItem, Reviewer } from '../services/overview';

/** Which made-up world the demo backend shows; picked with `?scenario=` in the URL. */
export type DemoScenario = 'full' | 'empty' | 'not-installed' | 'errors';

export const DEMO_SCENARIOS: readonly DemoScenario[] = ['full', 'empty', 'not-installed', 'errors'];

/** An item with the creation time the list pages sort by. */
export interface DemoItem {
  item: OverviewItem;
  createdAt: string;
}

/** Everything the demo backend answers with. All names are fictional. */
export interface DemoWorld {
  login: string;
  access: GitHubAccess;
  lists: Record<ListName, DemoItem[]>;
  organizations: Record<string, OrgOverview>;
}

const LOGIN = 'demo-user';

const LABELS: Record<string, Label> = {
  bug: { name: 'bug', color: 'd73a4a' },
  enhancement: { name: 'enhancement', color: 'a2eeef' },
  documentation: { name: 'documentation', color: '0075ca' },
  goodFirstIssue: { name: 'good first issue', color: '7057ff' },
  frontend: { name: 'frontend', color: 'fbca04' },
  backend: { name: 'backend', color: '0e8a16' },
  security: { name: 'security', color: 'b60205' },
  dependencies: { name: 'dependencies', color: '0366d6' },
};

const REPOSITORIES = [
  'demo-user/hoot-demo',
  'demo-user/dotfiles',
  'demo-labs/rocket',
  'demo-labs/launchpad',
  'demo-orbit/telescope',
];

const ISSUE_TITLES = [
  'Login button does nothing on Safari',
  'Dark mode colours are too low in contrast',
  'Crash when the config file is empty',
  'Document the release process',
  'Search ignores archived repositories',
  'Add keyboard shortcuts to the list',
  'Upgrade the test runner',
  'Timezone is wrong in the export',
  'Flaky test in the scheduler',
  'Support SSO sign-in',
  'Rate limit errors are not retried',
  'Sidebar overflows on small screens',
];

const LABEL_SETS: Label[][] = [
  [LABELS['bug'], LABELS['frontend']],
  [LABELS['enhancement']],
  [LABELS['bug'], LABELS['backend'], LABELS['security']],
  [LABELS['documentation']],
  [],
  [LABELS['enhancement'], LABELS['goodFirstIssue']],
  [LABELS['dependencies']],
];

/** Build the made-up world for a scenario; times are relative to `now`. */
export function demoWorld(scenario: DemoScenario, now: Date): DemoWorld {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();
  const installed = scenario !== 'not-installed';
  const filled = scenario === 'full' || scenario === 'errors';
  return {
    login: LOGIN,
    access: {
      install_url: 'https://github.com/apps/hoot-demo/installations/new',
      installations: installed ? demoInstallations() : [],
    },
    lists: filled
      ? {
          pull_requests: ownPullRequests(at),
          review_requests: reviewRequests(at),
          assigned_issues: assignedIssues(at),
          mentions: mentions(at),
        }
      : { pull_requests: [], review_requests: [], assigned_issues: [], mentions: [] },
    organizations: filled
      ? { 'demo-labs': teamView('demo-labs', at), 'demo-orbit': teamView('demo-orbit', at) }
      : {},
  };
}

function demoInstallations(): GitHubAccess['installations'] {
  return [
    {
      account: LOGIN,
      account_type: 'User',
      all_repositories: true,
      settings_url: 'https://github.com/settings/installations/1',
    },
    {
      account: 'demo-labs',
      account_type: 'Organization',
      all_repositories: false,
      settings_url: 'https://github.com/organizations/demo-labs/settings/installations/2',
    },
    {
      account: 'demo-orbit',
      account_type: 'Organization',
      all_repositories: true,
      settings_url: 'https://github.com/organizations/demo-orbit/settings/installations/3',
    },
  ];
}

type At = (hoursAgo: number) => string;

function issue(
  at: At,
  repository: string,
  number: number,
  options: {
    title?: string;
    labels?: Label[];
    updated: number;
    created: number;
    comments?: number;
    milestone?: string;
  },
): DemoItem {
  return {
    item: {
      kind: 'issue',
      title: options.title ?? ISSUE_TITLES[number % ISSUE_TITLES.length],
      repository,
      number,
      url: `https://github.com/${repository}/issues/${number}`,
      updated_at: at(options.updated),
      labels: options.labels ?? LABEL_SETS[number % LABEL_SETS.length],
      comment_count: options.comments ?? number % 7,
      milestone: options.milestone ?? null,
    },
    createdAt: at(options.created),
  };
}

function pullRequest(
  at: At,
  repository: string,
  number: number,
  options: {
    title: string;
    updated: number;
    created: number;
    ci?: string | null;
    review?: string | null;
    draft?: boolean;
    reviewers?: Reviewer[];
    checks?: Check[];
    labels?: Label[];
    milestone?: string;
  },
): DemoItem {
  const item: PullRequestItem = {
    kind: 'pull_request',
    title: options.title,
    repository,
    number,
    url: `https://github.com/${repository}/pull/${number}`,
    updated_at: at(options.updated),
    labels: options.labels ?? [],
    comment_count: number % 9,
    milestone: options.milestone ?? null,
    ci_status: options.ci ?? null,
    review_decision: options.review ?? null,
    draft: options.draft ?? false,
    reviewers: options.reviewers ?? [],
    checks: options.checks ?? [],
  };
  return { item, createdAt: at(options.created) };
}

const check = (name: string, state: Check['state']): Check => ({
  name,
  state,
  url: state === 'neutral' ? null : `https://github.com/demo/checks/${name}`,
});

function ownPullRequests(at: At): DemoItem[] {
  return [
    pullRequest(at, 'demo-user/hoot-demo', 41, {
      title: 'Add the overview dashboard',
      updated: 1,
      created: 30,
      ci: 'FAILURE',
      review: 'CHANGES_REQUESTED',
      reviewers: [
        { name: 'demo-ana', state: 'CHANGES_REQUESTED' },
        { name: 'demo-ben', state: 'COMMENTED' },
      ],
      checks: [check('backend', 'success'), check('lint', 'failure'), check('e2e', 'failure')],
      labels: [LABELS['frontend'], LABELS['enhancement']],
      milestone: 'v1.0',
    }),
    pullRequest(at, 'demo-user/hoot-demo', 44, {
      title: 'Experiment: offline mode',
      updated: 3,
      created: 5,
      ci: 'PENDING',
      review: 'REVIEW_REQUIRED',
      draft: true,
      reviewers: [{ name: 'frontend-team', state: 'REQUESTED' }],
      checks: [check('backend', 'success'), check('frontend', 'pending'), check('docs', 'neutral')],
    }),
    pullRequest(at, 'demo-labs/rocket', 128, {
      title: 'Retry rate-limited requests with backoff',
      updated: 6,
      created: 52,
      ci: 'SUCCESS',
      review: 'APPROVED',
      reviewers: [
        { name: 'demo-cleo', state: 'APPROVED' },
        { name: 'demo-dan', state: 'APPROVED' },
      ],
      checks: [check('build', 'success'), check('test', 'success')],
      labels: [LABELS['backend']],
      milestone: 'Sprint 12',
    }),
    pullRequest(at, 'demo-user/dotfiles', 7, {
      title: 'Switch the shell prompt to a faster theme',
      updated: 26,
      created: 80,
      review: 'REVIEW_REQUIRED',
    }),
    pullRequest(at, 'demo-orbit/telescope', 312, {
      title: 'Bump the image library to 4.2',
      updated: 50,
      created: 51,
      ci: 'SUCCESS',
      checks: [check('ci', 'success')],
      labels: [LABELS['dependencies']],
    }),
  ];
}

function reviewRequests(at: At): DemoItem[] {
  const titles = [
    'Cache the installation list',
    'Rename the settings page',
    'Add Spanish translations',
    'Fix the flaky upload test',
  ];
  return titles
    .map((title, index) =>
      issue(at, REPOSITORIES[(index + 2) % REPOSITORIES.length], 200 + index, {
        title,
        updated: 2 + index * 9,
        created: 20 + index * 15,
        labels: index === 3 ? [LABELS['bug']] : [],
      }),
    )
    .map(({ item, createdAt }) => ({
      item: { ...item, kind: 'pull_request' as const, url: item.url.replace('/issues/', '/pull/') },
      createdAt,
    }));
}

/** 62 issues, so the list page needs "Load more" and the overview says "50+". */
function assignedIssues(at: At): DemoItem[] {
  return Array.from({ length: 62 }, (_, index) =>
    issue(at, REPOSITORIES[index % REPOSITORIES.length], 10 + index, {
      updated: 4 + index * 7,
      created: 100 + index * 13,
      milestone: index % 5 === 0 ? 'v1.0' : undefined,
    }),
  );
}

function mentions(at: At): DemoItem[] {
  return [
    issue(at, 'demo-labs/launchpad', 77, {
      title: 'Which region should the staging cluster use?',
      updated: 0.5,
      created: 12,
      comments: 14,
      labels: [],
    }),
    issue(at, 'demo-orbit/telescope', 290, {
      title: 'Roadmap for the next release',
      updated: 30,
      created: 400,
      comments: 31,
      labels: [LABELS['documentation']],
    }),
    issue(at, 'demo-labs/rocket', 131, {
      title: 'Security review of the token handling',
      updated: 75,
      created: 90,
      labels: [LABELS['security']],
    }),
  ];
}

function teamItem(
  at: At,
  organization: string,
  number: number,
  options: {
    title: string;
    kind: 'issue' | 'pull_request';
    author: string | null;
    assignees: string[];
    updated: number;
    created: number;
    ci?: string | null;
  },
): TeamItem {
  const repository = `${organization}/${organization === 'demo-labs' ? 'rocket' : 'telescope'}`;
  return {
    kind: options.kind,
    title: options.title,
    repository,
    number,
    url: `https://github.com/${repository}/${options.kind === 'issue' ? 'issues' : 'pull'}/${number}`,
    updated_at: at(options.updated),
    labels: number % 2 === 0 ? [LABELS['bug']] : [],
    comment_count: number % 5,
    milestone: null,
    created_at: at(options.created),
    author: options.author,
    assignees: options.assignees,
    ci_status: options.ci ?? null,
    review_decision: options.kind === 'pull_request' ? 'REVIEW_REQUIRED' : null,
  };
}

function teamView(organization: string, at: At): OrgOverview {
  const list = (items: TeamItem[], total = items.length) => ({
    total,
    items,
    search_url: `https://github.com/search?q=org%3A${organization}&type=issues`,
  });
  return {
    organization,
    stale_after_days: 60,
    waiting_for_review: list([
      teamItem(at, organization, 501, {
        title: 'Add a health check endpoint',
        kind: 'pull_request',
        author: 'demo-ana',
        assignees: [],
        updated: 20,
        created: 140,
      }),
      teamItem(at, organization, 502, {
        title: 'Move CI to the new runners',
        kind: 'pull_request',
        author: 'demo-ben',
        assignees: ['demo-cleo'],
        updated: 3,
        created: 60,
      }),
    ]),
    failing_ci: list(
      [
        teamItem(at, organization, 510, {
          title: 'Upgrade the database driver',
          kind: 'pull_request',
          author: 'demo-dan',
          assignees: [],
          updated: 1,
          created: 30,
          ci: 'FAILURE',
        }),
      ],
      23,
    ),
    unassigned_issues: list([
      teamItem(at, organization, 520, {
        title: 'Error page shows a stack trace',
        kind: 'issue',
        author: 'demo-cleo',
        assignees: [],
        updated: 48,
        created: 300,
      }),
      teamItem(at, organization, 521, {
        title: 'Onboarding guide is out of date',
        kind: 'issue',
        author: null,
        assignees: [],
        updated: 200,
        created: 900,
      }),
      teamItem(at, organization, 522, {
        title: 'Export to CSV',
        kind: 'issue',
        author: 'demo-ben',
        assignees: [],
        updated: 90,
        created: 400,
      }),
    ]),
    stale: list([
      teamItem(at, organization, 530, {
        title: 'Investigate memory growth',
        kind: 'issue',
        author: 'demo-ana',
        assignees: ['demo-ben'],
        updated: 1700,
        created: 3000,
      }),
    ]),
  };
}
