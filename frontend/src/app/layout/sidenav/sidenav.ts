import { Component, ChangeDetectionStrategy, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { GitHubAccessService } from '../../services/github-access';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidenav.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./sidenav.css'],
})
export class Sidenav {
  private readonly gitHubAccess = inject(GitHubAccessService);

  /** Organizations where Hoot is installed for the user, each with a team view. */
  readonly organizations = signal<string[]>([]);

  constructor(public auth: AuthService) {
    effect(() => {
      this.organizations.set([]);
      if (this.auth.isLoggedIn()) {
        this.loadOrganizations();
      }
    });
  }

  logout() {
    this.auth.logout();
  }

  private loadOrganizations(): void {
    this.gitHubAccess.load().subscribe({
      next: (access) =>
        this.organizations.set(
          access.installations
            .filter((installation) => installation.account_type === 'Organization')
            .map((installation) => installation.account),
        ),
      // The links are a shortcut; without them the rest of the app still works.
      error: () => this.organizations.set([]),
    });
  }
}
