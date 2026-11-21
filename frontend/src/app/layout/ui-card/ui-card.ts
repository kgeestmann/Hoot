import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [CommonModule],
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
