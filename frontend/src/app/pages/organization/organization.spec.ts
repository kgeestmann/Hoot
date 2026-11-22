import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, NEVER, Observable, of, Subject, throwError } from 'rxjs';

import {
  OrganizationsService,
  OrgOverview,
  TeamItem,
  TeamList,
} from '../../services/organizations';
import { OrganizationPage } from './organization';

const ITEM: TeamItem = {
  kind: 'pull_request',
  title: 'Add the overview API',
  repository: 'Octo-Org/hoot',
  number: 7,
  url: 'https://github.com/Octo-Org/hoot/pull/7',
  updated_at: '2026-11-20T10:00:00Z',
  labels: [],
  created_at: '2026-11-01T10:00:00Z',
  author: 'alice',
  assignees: ['bob'],
  ci_status: 'FAILURE',
  review_decision: 'REVIEW_REQUIRED',
};

function list(total: number, items: TeamItem[] = []): TeamList {
  return { total, items, search_url: 'https://github.com/search?q=org%3AOcto-Org&type=issues' };
}

const OVERVIEW: OrgOverview = {
  organization: 'Octo-Org',
  stale_after_days: 60,
  waiting_for_review: list(1, [ITEM]),
  failing_ci: list(25, [
    ITEM,
    { ...ITEM, number: 8, url: 'https://github.com/Octo-Org/hoot/pull/8' },
  ]),
  unassigned_issues: list(0),
  stale: list(0),
};

describe('OrganizationPage', () => {
  let fixture: ComponentFixture<OrganizationPage>;
  let params: BehaviorSubject<ParamMap>;
  let load: ReturnType<typeof vi.fn<(organization: string) => Observable<OrgOverview>>>;

  async function render(answer: (organization: string) => Observable<OrgOverview>) {
    params = new BehaviorSubject(convertToParamMap({ organization: 'octo-org' }));
    load = vi.fn(answer);
    await TestBed.configureTestingModule({
      imports: [OrganizationPage],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: OrganizationsService, useValue: { load } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  /** Tab labels with their counts, e.g. "Failing CI 25". */
  function tabs(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('[role="tab"]')).map(
      (tab) => `${text(tab.querySelector('.tab-label'))} ${text(tab.querySelector('.tab-count'))}`,
    );
  }

  async function openTab(element: HTMLElement, label: string): Promise<void> {
    const tab = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (candidate) => text(candidate.querySelector('.tab-label')) === label,
    );
    tab!.click();
    await fixture.whenStable();
  }

  it('loads the organization from the URL and shows a skeleton meanwhile', async () => {
    const element = await render(() => NEVER);

    expect(load).toHaveBeenCalledWith('octo-org');
    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows the four team lists with GitHub's totals", async () => {
    const element = await render(() => of(OVERVIEW));

    expect(tabs(element)).toEqual([
      'Waiting for review 1',
      'Failing CI 25',
      'Unassigned 0',
      'No update for 60 days 0',
    ]);
  });

  it('opens on the first tab with items', async () => {
    const element = await render(() => of({ ...OVERVIEW, waiting_for_review: list(0) }));

    expect(text(element.querySelector('[role="tab"][aria-selected="true"] .tab-label'))).toBe(
      'Failing CI',
    );
    expect(element.querySelectorAll('a.item').length).toBe(2);
  });

  it('links to the full search when GitHub has more than the loaded items', async () => {
    const element = await render(() => of(OVERVIEW));

    await openTab(element, 'Failing CI');

    const more = Array.from(element.querySelectorAll<HTMLAnchorElement>('.more-link'));
    expect(more.map((link) => link.textContent!.trim())).toEqual(['Show all 25 on GitHub']);
    expect(more[0].href).toBe(OVERVIEW.failing_ci.search_url);
  });

  it('shows who opened an item and who is assigned', async () => {
    const element = await render(() => of(OVERVIEW));

    const meta = element.querySelector('app-overview-section .meta')!.textContent!;
    expect(meta).toContain('by alice');
    expect(meta).toContain('assigned to bob');
  });

  it('says when Hoot is not installed on the organization', async () => {
    const element = await render(() => throwError(() => new HttpErrorResponse({ status: 404 })));

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      "Hoot isn't installed on octo-org",
    );
  });

  it('loads again when retrying after an error', async () => {
    const answers = [throwError(() => new HttpErrorResponse({ status: 502 })), of(OVERVIEW)];
    const element = await render(() => answers.shift()!);

    element.querySelector<HTMLButtonElement>('.retry')!.click();
    await fixture.whenStable();

    expect(load).toHaveBeenCalledTimes(2);
    expect(tabs(element)).toContain('Failing CI 25');
  });

  it('refreshes while the current team view stays visible', async () => {
    const refreshed = new Subject<OrgOverview>();
    const answers: Observable<OrgOverview>[] = [of(OVERVIEW), refreshed];
    const element = await render(() => answers.shift()!);

    element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click();
    await fixture.whenStable();

    expect(load).toHaveBeenCalledTimes(2);
    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
    expect(tabs(element)).toContain('Failing CI 25');

    refreshed.next({ ...OVERVIEW, failing_ci: list(26, OVERVIEW.failing_ci.items) });
    refreshed.complete();
    await fixture.whenStable();

    expect(tabs(element)).toContain('Failing CI 26');
    expect(element.querySelector('mat-progress-bar')).toBeNull();
  });

  it('keeps the team view when a refresh fails', async () => {
    const answers: Observable<OrgOverview>[] = [
      of(OVERVIEW),
      throwError(() => new HttpErrorResponse({ status: 502 })),
    ];
    const element = await render(() => answers.shift()!);

    element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click();
    await fixture.whenStable();

    expect(tabs(element)).toContain('Failing CI 25');
    expect(text(element.querySelector('.updated'))).toContain("Couldn't refresh");
  });

  it('loads the new organization when the URL changes', async () => {
    const element = await render((organization) =>
      of({ ...OVERVIEW, organization: organization === 'other-org' ? 'Other-Org' : 'Octo-Org' }),
    );

    params.next(convertToParamMap({ organization: 'other-org' }));
    await fixture.whenStable();

    expect(load).toHaveBeenLastCalledWith('other-org');
    expect(tabs(element)).toContain('Failing CI 25');
  });
});
