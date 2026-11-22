import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterBar } from './filter-bar';
import { LabelOption, OwnerOption } from './filtering';

const OWNERS: OwnerOption[] = [
  {
    name: 'dipt-pa1469-ht26',
    scope: 'dipt-pa1469-ht26',
    hidden: true,
    repositories: [
      { name: 'dipt-pa1469-ht26/team-14', scope: 'dipt-pa1469-ht26/team-14', hidden: false },
    ],
  },
  {
    name: 'kgeestmann',
    scope: 'kgeestmann',
    hidden: false,
    repositories: [
      { name: 'kgeestmann/hoot', scope: 'kgeestmann/hoot', hidden: false },
      { name: 'kgeestmann/old-repo', scope: 'kgeestmann/old-repo', hidden: true },
    ],
  },
];

const LABELS: LabelOption[] = [
  { name: 'bug', key: 'bug', color: 'd73a4a', picked: true },
  { name: 'docs', key: 'docs', color: '0075ca', picked: false },
];

interface RenderOptions {
  owners?: OwnerOption[];
  labels?: LabelOption[];
  shown?: number;
  total?: number;
  saveFailed?: boolean;
}

describe('FilterBar', () => {
  let fixture: ComponentFixture<FilterBar>;

  async function render(options: RenderOptions = {}) {
    await TestBed.configureTestingModule({ imports: [FilterBar] }).compileComponents();
    fixture = TestBed.createComponent(FilterBar);
    fixture.componentRef.setInput('owners', options.owners ?? OWNERS);
    fixture.componentRef.setInput('labels', options.labels ?? LABELS);
    fixture.componentRef.setInput('shownCount', options.shown ?? 3);
    fixture.componentRef.setInput('totalCount', options.total ?? 5);
    fixture.componentRef.setInput('saveFailed', options.saveFailed ?? false);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function buttons(element: HTMLElement): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.filter-button'));
  }

  async function openMenu(element: HTMLElement, index: number): Promise<HTMLElement[]> {
    buttons(element)[index].click();
    await fixture.whenStable();
    return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'));
  }

  it('says on each button how much of it is shown', async () => {
    const element = await render();

    expect(buttons(element).map(text)).toEqual([
      'Owner: 1 of 2',
      'Repository: 1 of 3',
      'Label: bug',
    ]);
    expect(buttons(element).every((button) => button.classList.contains('active'))).toBe(true);
  });

  it('keeps plain button names while nothing is filtered', async () => {
    const element = await render({
      owners: OWNERS.map((owner) => ({
        ...owner,
        hidden: false,
        repositories: owner.repositories.map((repository) => ({ ...repository, hidden: false })),
      })),
      labels: LABELS.map((label) => ({ ...label, picked: false })),
      shown: 5,
    });

    expect(buttons(element).map(text)).toEqual(['Owner', 'Repository', 'Label']);
    expect(text(element.querySelector('.summary'))).toBe('Showing 5 of 5');
    expect(element.querySelector('.clear')).toBeNull();
  });

  it('summarises what the filters hide and offers to clear them', async () => {
    const element = await render();

    expect(text(element.querySelector('.summary'))).toBe('Showing 3 of 5 · 2 hidden');
    expect(text(element.querySelector('.clear'))).toBe('Clear filters');
  });

  it('lists owners as checkable menu items and emits the one clicked', async () => {
    const element = await render();
    const toggled: string[] = [];
    fixture.componentInstance.toggleScope.subscribe((scope) => toggled.push(scope));

    const options = await openMenu(element, 0);

    expect(options.map((option) => [text(option), option.getAttribute('aria-checked')])).toEqual([
      ['dipt-pa1469-ht26', 'false'],
      ['kgeestmann', 'true'],
    ]);
    options[0].click();
    expect(toggled).toEqual(['dipt-pa1469-ht26']);
  });

  it('disables the repositories of a hidden owner', async () => {
    const element = await render();

    const options = await openMenu(element, 1);

    expect(options.map((option) => [text(option), option.hasAttribute('disabled')])).toEqual([
      ['dipt-pa1469-ht26/team-14', true],
      ['kgeestmann/hoot', false],
      ['kgeestmann/old-repo', false],
    ]);
  });

  it('lists labels with their colour and emits the one picked', async () => {
    const element = await render();
    const toggled: string[] = [];
    fixture.componentInstance.toggleLabel.subscribe((label) => toggled.push(label));

    const options = await openMenu(element, 2);

    expect(options.map((option) => [text(option), option.getAttribute('aria-checked')])).toEqual([
      ['bug', 'true'],
      ['docs', 'false'],
    ]);
    expect(options[1].querySelector<HTMLElement>('.label-dot')!.style.backgroundColor).toBe(
      'rgb(0, 117, 202)',
    );
    options[1].click();
    expect(toggled).toEqual(['docs']);
  });

  it('keeps a menu open while options are changed', async () => {
    const element = await render();

    const options = await openMenu(element, 0);
    options[1].click();
    await fixture.whenStable();

    expect(document.querySelectorAll('[role="menuitemcheckbox"]').length).toBe(2);
  });

  it('warns when the filters could not be saved', async () => {
    const element = await render({ saveFailed: true });

    expect(element.querySelector('[role="alert"]')!.textContent).toContain("couldn't be saved");
  });
});
