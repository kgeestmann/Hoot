import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './ui-button.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./ui-button.css'],
})
export class UiButtonComponent {
  @Input() variant: string = 'default';
  @Input() size: string = 'default';
  @Input() disabled: boolean = false;
  @Input() type: string = 'button';
}
