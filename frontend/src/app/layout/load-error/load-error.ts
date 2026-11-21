import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** An error box that says what went wrong, with a button to try again (#55, rule 7). */
@Component({
  selector: 'app-load-error',
  templateUrl: './load-error.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './load-error.css',
})
export class LoadError {
  readonly message = input.required<string>();
  readonly retry = output<void>();
}

/** Say whose fault a failed load is, so the user knows whether retrying can help. */
export function loadErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return "Can't reach Hoot's server. Check your connection and try again.";
  }
  return "GitHub didn't answer. Try again in a moment.";
}
