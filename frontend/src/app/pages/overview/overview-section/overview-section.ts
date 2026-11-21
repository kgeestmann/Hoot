import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { OverviewItem } from '../../../services/overview';
import { OverviewItemComponent } from '../overview-item/overview-item';

/** One list on the overview (e.g. review requests) with its items or an empty message. */
@Component({
  selector: 'app-overview-section',
  imports: [OverviewItemComponent],
  templateUrl: './overview-section.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './overview-section.css',
})
export class OverviewSection {
  readonly heading = input.required<string>();
  readonly items = input.required<readonly OverviewItem[]>();
  readonly emptyText = input.required<string>();
}
