import { TemplatePortal } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageToolbar, PageToolbarContent } from './page-toolbar';

@Component({
  imports: [PageToolbarContent],
  template: `
    @if (shown()) {
      <ng-template appPageToolbar><span class="tool">Filters</span></ng-template>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
class Page {
  readonly shown = signal(true);
}

describe('PageToolbarContent', () => {
  async function render(hosted: boolean) {
    TestBed.inject(PageToolbar).hosted = hosted;
    const fixture = TestBed.createComponent(Page);
    await fixture.whenStable();
    return fixture;
  }

  it('hands its template to the top bar when the layout hosts one', async () => {
    const fixture = await render(true);

    const toolbar = TestBed.inject(PageToolbar);
    expect(toolbar.portal()).toBeInstanceOf(TemplatePortal);
    expect(fixture.nativeElement.querySelector('.tool')).toBeNull();
  });

  it('renders in place without the layout', async () => {
    const fixture = await render(false);

    expect(fixture.nativeElement.querySelector('.tool').textContent).toBe('Filters');
    expect(TestBed.inject(PageToolbar).portal()).toBeNull();
  });

  it('clears the top bar when the page goes', async () => {
    const fixture = await render(true);

    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();

    expect(TestBed.inject(PageToolbar).portal()).toBeNull();
  });

  it("leaves the next page's toolbar in place", async () => {
    const fixture = await render(true);
    const toolbar = TestBed.inject(PageToolbar);
    const next = new TemplatePortal(
      toolbar.portal()!.templateRef,
      toolbar.portal()!.viewContainerRef,
    );
    toolbar.portal.set(next);

    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();

    expect(toolbar.portal()).toBe(next);
  });
});
