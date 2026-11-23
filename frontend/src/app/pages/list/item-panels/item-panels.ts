import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';

import { OverviewItem } from '../../../services/overview';
import { hasChips, ItemChips } from '../../overview/item/item-chips';
import { ItemMeta } from '../../overview/item/item-meta';
import { ItemDetails } from './item-details';

/** Items as expandable entries: the header reads like an overview row, the panel has the details. */
@Component({
  selector: 'app-item-panels',
  imports: [ItemChips, ItemDetails, ItemMeta, MatExpansionModule],
  templateUrl: './item-panels.html',
  styleUrl: './item-panels.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ItemPanels {
  readonly items = input.required<readonly OverviewItem[]>();

  readonly rows = computed(() => this.items().map((item) => ({ item, hasChips: hasChips(item) })));
}
