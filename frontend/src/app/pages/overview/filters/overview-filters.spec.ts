import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OwnerOption } from './filtering';
import { OverviewFilters } from './overview-filters';

const OPTIONS: OwnerOption[] = [
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

describe('OverviewFilters', () => {
  let fixture: ComponentFixture<OverviewFilters>;

  async function render(hiddenCount = 3, saveFailed = false) {
    await TestBed.configureTestingModule({ imports: [OverviewFilters] }).compileComponents();
    fixture = TestBed.createComponent(OverviewFilters);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('hiddenCount', hiddenCount);
    fixture.componentRef.setInput('saveFailed', saveFailed);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function checkbox(element: HTMLElement, label: string): HTMLInputElement {
    const option = Array.from(element.querySelectorAll('label')).find(
      (candidate) => candidate.textContent!.trim() === label,
    );
    return option!.querySelector('input')!;
  }

  it('says how many items are hidden', async () => {
    const element = await render(3);

    expect(element.querySelector('summary')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Filter 3 hidden',
    );
  });

  it('does not mention hidden items when nothing is hidden', async () => {
    const element = await render(0);

    expect(element.querySelector('.hidden-count')).toBeNull();
  });

  it('checks what is shown and unchecks what is hidden', async () => {
    const element = await render();

    expect(checkbox(element, 'kgeestmann').checked).toBe(true);
    expect(checkbox(element, 'kgeestmann/hoot').checked).toBe(true);
    expect(checkbox(element, 'kgeestmann/old-repo').checked).toBe(false);
    expect(checkbox(element, 'dipt-pa1469-ht26').checked).toBe(false);
  });

  it('disables the repositories of a hidden owner', async () => {
    const element = await render();

    const repository = checkbox(element, 'dipt-pa1469-ht26/team-14');
    expect(repository.disabled).toBe(true);
    expect(repository.checked).toBe(false);
  });

  it('emits the scope of the option that was clicked', async () => {
    const element = await render();
    const toggled: string[] = [];
    fixture.componentInstance.toggle.subscribe((scope) => toggled.push(scope));

    checkbox(element, 'kgeestmann/old-repo').click();
    checkbox(element, 'dipt-pa1469-ht26').click();

    expect(toggled).toEqual(['kgeestmann/old-repo', 'dipt-pa1469-ht26']);
  });

  it('warns when the filter could not be saved', async () => {
    const element = await render(3, true);

    expect(element.querySelector('[role="alert"]')!.textContent).toContain("couldn't be saved");
  });
});
