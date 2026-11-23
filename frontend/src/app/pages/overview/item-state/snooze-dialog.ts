import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';

import { morningOf, pickableDays } from './snooze-times';

/** Asks for the day a snooze ends; closes with that day's morning, or nothing when cancelled. */
@Component({
  selector: 'app-snooze-dialog',
  imports: [MatButtonModule, MatDatepickerModule, MatDialogModule],
  providers: [provideNativeDateAdapter()],
  template: `<h2 mat-dialog-title>Snooze until</h2>
    <mat-dialog-content>
      <mat-calendar
        [minDate]="days.first"
        [maxDate]="days.last"
        [selected]="picked()"
        (selectedChange)="picked.set($event)"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [disabled]="!picked()" [mat-dialog-close]="until()">Snooze</button>
    </mat-dialog-actions>`,
  styles: `
    mat-calendar {
      width: 296px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SnoozeDialog {
  readonly days = pickableDays(new Date());
  readonly picked = signal<Date | null>(null);

  until(): Date | undefined {
    const picked = this.picked();
    return picked ? morningOf(picked) : undefined;
  }
}
