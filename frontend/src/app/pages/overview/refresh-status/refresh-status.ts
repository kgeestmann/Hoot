import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { filter, fromEvent, interval, map } from 'rxjs';

import { relativeTime } from '../item/relative-time';

/** Coming back to the browser tab after this long refreshes the data. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * "Updated 5 minutes ago" with a refresh button, and a progress bar while refreshing.
 * Asks for a refresh by itself when the user returns to the tab and the data is stale.
 */
@Component({
  selector: 'app-refresh-status',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './refresh-status.html',
  styleUrl: './refresh-status.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class RefreshStatus {
  private readonly document = inject(DOCUMENT);

  readonly loadedAt = input.required<Date>();
  readonly refreshing = input(false);
  readonly failed = input(false);
  readonly refresh = output<void>();

  /** Ticks every 30 seconds, so "updated … ago" stays current. */
  private readonly now = toSignal(interval(30_000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });
  readonly updatedAgo = computed(() => relativeTime(this.loadedAt(), new Date(this.now())));

  constructor() {
    fromEvent(this.document, 'visibilitychange')
      .pipe(
        filter(() => this.document.visibilityState === 'visible' && this.isStale()),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.refresh.emit());
  }

  private isStale(): boolean {
    return !this.refreshing() && Date.now() - this.loadedAt().getTime() > STALE_AFTER_MS;
  }
}
