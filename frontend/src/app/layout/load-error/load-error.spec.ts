import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { LoadError, loadErrorMessage } from './load-error';

describe('LoadError', () => {
  it('shows the message and emits retry when the button is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [LoadError] }).compileComponents();
    const fixture = TestBed.createComponent(LoadError);
    fixture.componentRef.setInput('message', 'GitHub did not answer.');
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.retry')!.click();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'GitHub did not answer.',
    );
    expect(retries).toBe(1);
  });
});

describe('loadErrorMessage', () => {
  it("blames Hoot's server when it can't be reached", () => {
    expect(loadErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain(
      "Can't reach Hoot's server",
    );
  });

  it('blames GitHub otherwise', () => {
    expect(loadErrorMessage(new HttpErrorResponse({ status: 502 }))).toContain(
      "GitHub didn't answer",
    );
  });
});
