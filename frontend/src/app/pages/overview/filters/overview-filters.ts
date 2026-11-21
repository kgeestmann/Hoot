import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OwnerOption } from './filtering';

/** Collapsible panel with a checkbox per owner and repository; unchecking hides it. */
@Component({
  selector: 'app-overview-filters',
  templateUrl: './overview-filters.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview-filters.css',
})
export class OverviewFilters {
  readonly options = input.required<OwnerOption[]>();
  readonly hiddenCount = input.required<number>();
  readonly saveFailed = input(false);

  /** Emits the lowercase scope ("owner" or "owner/repo") whose visibility should flip. */
  readonly toggle = output<string>();
}
