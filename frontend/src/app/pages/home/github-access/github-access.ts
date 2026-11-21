import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { UiCardComponent } from '../../../layout/ui-card/ui-card';
import { GitHubAccess, GitHubAccessService } from '../../../services/github-access';

/** Shows where Hoot can see the user's repositories and links to GitHub to add more. */
@Component({
  selector: 'app-github-access',
  standalone: true,
  imports: [UiCardComponent],
  templateUrl: './github-access.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./github-access.css'],
})
export class GitHubAccessCard implements OnInit {
  private readonly gitHubAccess = inject(GitHubAccessService);

  /** `undefined` while loading. */
  readonly access = signal<GitHubAccess | undefined>(undefined);
  readonly loadFailed = signal(false);

  ngOnInit(): void {
    this.gitHubAccess.load().subscribe({
      next: (access) => this.access.set(access),
      error: () => this.loadFailed.set(true),
    });
  }
}
