import { BreakpointObserver } from '@angular/cdk/layout';
import {
  Component,
  ChangeDetectionStrategy,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth';
import { Icon } from '../icon/icon';
import { GitHubAccessService } from '../../services/github-access';

const WIDE_SCREEN = '(min-width: 840px)';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [Icon, MatButtonModule, MatSidenavModule, MatToolbarModule, RouterModule],
  templateUrl: './sidenav.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./sidenav.css'],
})
export class Sidenav {
  private readonly gitHubAccess = inject(GitHubAccessService);
  private readonly drawer = viewChild.required(MatSidenav);

  /** At least Material 3's "expanded" width: the navigation stays open beside the content. */
  readonly isWide = toSignal(
    inject(BreakpointObserver)
      .observe(WIDE_SCREEN)
      .pipe(map((state) => state.matches)),
    { initialValue: inject(BreakpointObserver).isMatched(WIDE_SCREEN) },
  );

  /** Organizations where Hoot is installed for the user, each with a team view. */
  readonly organizations = signal<string[]>([]);

  constructor(public auth: AuthService) {
    effect(() => {
      this.organizations.set([]);
      if (this.auth.isLoggedIn()) {
        this.loadOrganizations();
      }
    });

    // On small screens the drawer covers the page, so it closes once a page is chosen.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (!this.isWide()) {
          this.drawer().close();
        }
      });
  }

  openNavigation(): void {
    this.drawer().open();
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
