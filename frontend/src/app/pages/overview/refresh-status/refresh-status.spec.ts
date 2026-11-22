import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefreshStatus, STALE_AFTER_MS } from './refresh-status';

describe('RefreshStatus', () => {
  let fixture: ComponentFixture<RefreshStatus>;
  let refreshes: number;

  async function render({
    loadedAt = new Date(),
    refreshing = false,
    failed = false,
  }: { loadedAt?: Date; refreshing?: boolean; failed?: boolean } = {}) {
    await TestBed.configureTestingModule({ imports: [RefreshStatus] }).compileComponents();
    fixture = TestBed.createComponent(RefreshStatus);
    fixture.componentRef.setInput('loadedAt', loadedAt);
    fixture.componentRef.setInput('refreshing', refreshing);
    fixture.componentRef.setInput('failed', failed);
    refreshes = 0;
    fixture.componentInstance.refresh.subscribe(() => refreshes++);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function returnToTab(): void {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => {
    delete (document as unknown as { visibilityState?: string }).visibilityState;
  });

  it('says when the data was loaded', async () => {
    const element = await render({ loadedAt: new Date(Date.now() - 5 * 60 * 1000) });

    expect(text(element.querySelector('.updated'))).toBe('Updated 5 minutes ago');
  });

  it('asks for a refresh when the button is clicked', async () => {
    const element = await render();

    element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.click();

    expect(refreshes).toBe(1);
  });

  it('shows progress and disables the button while refreshing', async () => {
    const element = await render({ refreshing: true });

    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!.disabled).toBe(true);
  });

  it('says when a refresh failed', async () => {
    const element = await render({ failed: true });

    expect(text(element.querySelector('.updated'))).toBe("Couldn't refresh · Updated just now");
  });

  it('refreshes when the user returns to the tab and the data is stale', async () => {
    await render({ loadedAt: new Date(Date.now() - STALE_AFTER_MS - 1000) });

    returnToTab();

    expect(refreshes).toBe(1);
  });

  it('does not refresh fresh data when the user returns to the tab', async () => {
    await render({ loadedAt: new Date() });

    returnToTab();

    expect(refreshes).toBe(0);
  });

  it('does not start a second refresh while one is running', async () => {
    await render({ loadedAt: new Date(Date.now() - STALE_AFTER_MS - 1000), refreshing: true });

    returnToTab();

    expect(refreshes).toBe(0);
  });
});
