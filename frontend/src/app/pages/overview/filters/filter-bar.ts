import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPseudoCheckboxModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { labelColors } from '../item/label-colors';
import { LabelOption, OwnerOption } from './filtering';

/**
 * Owner, Repository and Label buttons that open menus of checkable options, followed by how
 * much the filters hide. Options are `menuitemcheckbox`es, so the menus work with the keyboard.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatPseudoCheckboxModule],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FilterBar {
  readonly owners = input.required<OwnerOption[]>();
  readonly labels = input.required<LabelOption[]>();
  readonly shownCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly saveFailed = input(false);

  /** Emits a lowercase owner or "owner/repo" whose visibility should flip. */
  readonly toggleScope = output<string>();
  /** Emits a lowercase label name to pick or unpick. */
  readonly toggleLabel = output<string>();
  readonly clear = output<void>();

  readonly shownOwners = computed(() => this.owners().filter((owner) => !owner.hidden).length);
  readonly repositories = computed(() => this.owners().flatMap((owner) => owner.repositories));
  readonly shownRepositories = computed(
    () =>
      this.owners().flatMap((owner) =>
        owner.hidden ? [] : owner.repositories.filter((r) => !r.hidden),
      ).length,
  );
  readonly pickedLabels = computed(() => this.labels().filter((label) => label.picked));
  readonly labelChips = computed(() =>
    this.labels().map((label) => ({ ...label, dot: labelColors(label.color).background })),
  );
  readonly hiddenCount = computed(() => this.totalCount() - this.shownCount());
  readonly anyFilter = computed(
    () =>
      this.owners().some((owner) => owner.hidden || owner.repositories.some((r) => r.hidden)) ||
      this.pickedLabels().length > 0,
  );

  readonly ownerText = computed(() => {
    const total = this.owners().length;
    return this.shownOwners() === total ? 'Owner' : `Owner: ${this.shownOwners()} of ${total}`;
  });
  readonly repositoryText = computed(() => {
    const total = this.repositories().length;
    return this.shownRepositories() === total
      ? 'Repository'
      : `Repository: ${this.shownRepositories()} of ${total}`;
  });
  readonly labelText = computed(() => {
    const picked = this.pickedLabels();
    if (picked.length === 0) {
      return 'Label';
    }
    return picked.length === 1 ? `Label: ${picked[0].name}` : `Labels: ${picked.length}`;
  });

  /** Flip an option without closing the menu, so several can be changed in a row. */
  keepOpen(event: Event): void {
    event.stopPropagation();
  }
}
