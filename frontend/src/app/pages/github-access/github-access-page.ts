import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { LoadError, loadErrorMessage } from '../../layout/load-error/load-error';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { GitHubAccessCard } from './github-access';

/** Where Hoot can see the user's repositories, and where to install it on more accounts. */
@Component({
  selector: 'app-github-access-page',
  imports: [GitHubAccessCard, LoadError, MatProgressBarModule],
  templateUrl: './github-access-page.html',
  styleUrl: './github-access-page.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GitHubAccessPage implements OnInit {
  private readonly gitHubAccess = inject(GitHubAccessService);

  /** `undefined` while loading or after an error. */
  readonly access = signal<GitHubAccess | undefined>(undefined);
  readonly loadError = signal<string | undefined>(undefined);

  ngOnInit(): void {
    this.load();
  }

  /** Load the installations, e.g. again after an error. */
  load(): void {
    this.loadError.set(undefined);
    this.gitHubAccess.load().subscribe({
      next: (access) => this.access.set(access),
      error: (error: unknown) => this.loadError.set(loadErrorMessage(error)),
    });
  }
}
