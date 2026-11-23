import { EnvironmentInjector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';

import { SnoozeDialog } from './snooze-dialog';

/** How long a confirmation or error message stays. */
const MESSAGE_MS = 6000;

/** Ask for the day a snooze ends; emits the chosen morning, or nothing when cancelled. */
export function pickSnoozeEnd(injector: EnvironmentInjector): Observable<Date | undefined> {
  return injector.get(MatDialog).open<SnoozeDialog, void, Date>(SnoozeDialog).afterClosed();
}

/** Confirm a change with Undo, and say so when saving it fails. */
export function confirmChange(
  injector: EnvironmentInjector,
  saving: Observable<void>,
  messages: { done: string; failed: string },
  undo: () => Observable<void>,
): void {
  const snackBar = injector.get(MatSnackBar);
  const say = (message: string) => snackBar.open(message, undefined, { duration: MESSAGE_MS });
  snackBar
    .open(messages.done, 'Undo', { duration: MESSAGE_MS })
    .onAction()
    .subscribe(() => undo().subscribe({ error: () => say("Couldn't undo. Try again.") }));
  saving.subscribe({ error: () => say(`${messages.failed} Try again.`) });
}
