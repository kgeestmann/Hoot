import { OverviewItem, PullRequestItem } from '../../../services/overview';
import { statusChips } from './status-chips';

const ISSUE: OverviewItem = {
  kind: 'issue',
  title: 'Login button does nothing',
  repository: 'octo/hoot',
  number: 1,
  url: 'https://github.com/octo/hoot/issues/1',
  updated_at: '2026-11-21T10:00:00Z',
  labels: [],
};

function pullRequest(ci_status: string | null, review_decision: string | null): PullRequestItem {
  return { ...ISSUE, kind: 'pull_request', ci_status, review_decision };
}

describe('statusChips', () => {
  it('has no chips for issues', () => {
    expect(statusChips(ISSUE)).toEqual([]);
  });

  it.each([
    ['SUCCESS', 'CI passing', 'success'],
    ['FAILURE', 'CI failing', 'danger'],
    ['ERROR', 'CI failing', 'danger'],
    ['PENDING', 'CI running', 'neutral'],
    ['EXPECTED', 'CI running', 'neutral'],
  ])('labels CI status %s as "%s"', (ciStatus, label, tone) => {
    expect(statusChips(pullRequest(ciStatus, null))).toEqual([{ label, tone }]);
  });

  it.each([
    ['APPROVED', 'Approved', 'success'],
    ['CHANGES_REQUESTED', 'Changes requested', 'danger'],
    ['REVIEW_REQUIRED', 'Review required', 'neutral'],
  ])('labels review decision %s as "%s"', (decision, label, tone) => {
    expect(statusChips(pullRequest(null, decision))).toEqual([{ label, tone }]);
  });

  it('shows CI before review', () => {
    expect(statusChips(pullRequest('FAILURE', 'APPROVED')).map((chip) => chip.label)).toEqual([
      'CI failing',
      'Approved',
    ]);
  });

  it('leaves out states it does not know', () => {
    expect(statusChips(pullRequest('SOMETHING_NEW', null))).toEqual([]);
  });
});
