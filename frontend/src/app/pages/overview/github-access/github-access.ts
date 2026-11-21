import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { GitHubAccess } from '../../../services/github-access';

/** Shows where Hoot can see the user's repositories and links to GitHub to add more. */
@Component({
  selector: 'app-github-access',
  standalone: true,
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './github-access.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./github-access.css'],
})
export class GitHubAccessCard {
  readonly access = input.required<GitHubAccess>();
}
