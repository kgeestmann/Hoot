import {
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Observable } from 'rxjs';

import { OverviewItem } from '../../../services/overview';
import { ItemStateStore } from './item-state-store';
import { laterToday, nextWeek, tomorrow } from './snooze-times';

/**
 * A menu to mark an item as done or snooze it. Confirms with a snack bar offering Undo, and says
 * so when saving fails (the item then shows again).
 */
@Component({
  selector: 'app-item-actions',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './item-actions.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ItemActions {
  private readonly store = inject(ItemStateStore);
  // Not the component's own injector: the row, and this menu with it, disappears as soon as the
  // item is marked, before the snack bar has loaded.
  private readonly injector = inject(EnvironmentInjector);

  readonly item = input.required<OverviewItem>();

  readonly laterToday = laterToday;
  readonly tomorrow = tomorrow;
  readonly nextWeek = nextWeek;
  readonly now = () => new Date();

  markDone(): void {
    const item = this.item();
    this.confirm(this.store.markDone(item), item, {
      done: 'Marked as done',
      failed: "Couldn't mark it as done.",
    });
  }

  snooze(until: Date): void {
    const item = this.item();
    const when = until.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
    this.confirm(this.store.snooze(item, until), item, {
      done: `Snoozed until ${when}`,
      failed: "Couldn't snooze it.",
    });
  }

  async pickDate(): Promise<void> {
    const { pickSnoozeEnd } = await feedback();
    pickSnoozeEnd(this.injector).subscribe((until) => until && this.snooze(until));
  }

  private async confirm(
    saving: Observable<void>,
    item: OverviewItem,
    messages: { done: string; failed: string },
  ): Promise<void> {
    const { confirmChange } = await feedback();
    confirmChange(this.injector, saving, messages, () => this.store.restore(item));
  }
}

/** The snack bar and the date dialog load only when needed, keeping them out of the initial bundle. */
function feedback() {
  return import('./item-feedback');
}
