import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Grey placeholders in the shape of tabs over a list, shown while the list loads. */
@Component({
  selector: 'app-list-skeleton',
  templateUrl: './list-skeleton.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './list-skeleton.css',
})
export class ListSkeleton {
  /** Read out by screen readers, e.g. "Loading your overview". */
  readonly label = input.required<string>();
}
