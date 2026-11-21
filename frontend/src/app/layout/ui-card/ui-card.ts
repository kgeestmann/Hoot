import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  templateUrl: './ui-card.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./ui-card.css'],
})
export class UiCardComponent {
  @Input() title?: string;
  @Input() description?: string;
  @Input() elevation: 'flat' | 'low' | 'medium' | 'high' = 'medium';
  @Input() variant: 'raised' | 'inset' = 'raised';
}
