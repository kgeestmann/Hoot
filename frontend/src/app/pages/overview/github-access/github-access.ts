import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { UiCardComponent } from '../../../layout/ui-card/ui-card';
import { GitHubAccess } from '../../../services/github-access';

/** Shows where Hoot can see the user's repositories and links to GitHub to add more. */
@Component({
  selector: 'app-github-access',
  standalone: true,
  imports: [UiCardComponent],
  templateUrl: './github-access.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./github-access.css'],
})
export class GitHubAccessCard {
  readonly access = input.required<GitHubAccess>();
}
