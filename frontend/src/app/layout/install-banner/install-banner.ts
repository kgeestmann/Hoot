import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/** Tells a user whose GitHub App is installed nowhere why Hoot shows nothing, and how to fix it. */
@Component({
  selector: 'app-install-banner',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './install-banner.html',
  styleUrl: './install-banner.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class InstallBanner {
  readonly installUrl = input.required<string>();
}
