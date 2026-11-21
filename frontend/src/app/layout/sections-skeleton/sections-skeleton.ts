import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Grey placeholders in the shape of four list sections, shown while they load. */
@Component({
  selector: 'app-sections-skeleton',
  templateUrl: './sections-skeleton.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sections-skeleton.css',
})
export class SectionsSkeleton {
  /** Read out by screen readers, e.g. "Loading your overview". */
  readonly label = input.required<string>();
}
