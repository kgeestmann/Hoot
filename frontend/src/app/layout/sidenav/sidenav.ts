import { BreakpointObserver } from '@angular/cdk/layout';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth';
import { GitHubAccess, GitHubAccessService } from '../../services/github-access';
import { PageTitle } from '../../services/page-title';
import { LIST_PAGES } from '../../pages/list/list-pages';
import { InstallBanner } from '../install-banner/install-banner';

const WIDE_SCREEN = '(min-width: 840px)';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [
    InstallBanner,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterModule,
  ],
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

  readonly listPages = LIST_PAGES;
  /** Where Hoot is installed for the user; `undefined` until loaded or when that failed. */
  readonly access = signal<GitHubAccess | undefined>(undefined);
  /** Organizations where Hoot is installed for the user, each with a team view. */
  readonly organizations = computed(() =>
    (this.access()?.installations ?? [])
      .filter((installation) => installation.account_type === 'Organization')
      .map((installation) => installation.account),
  );
  private readonly currentUrl = signal('');
  /** The banner explains the empty lists everywhere but on the page that already does. */
  readonly showInstallBanner = computed(
    () =>
      this.access()?.installations.length === 0 && !this.currentUrl().startsWith('/github-access'),
  );
  readonly pageTitle = inject(PageTitle).current;
  /** First letter of the GitHub login, shown instead of loading the avatar from GitHub. */
  readonly initial = computed(() => this.auth.user()?.login.charAt(0).toUpperCase() ?? '');

  constructor(public auth: AuthService) {
    effect(() => {
      this.access.set(undefined);
      if (this.auth.isLoggedIn()) {
        this.loadAccess();
      }
    });

    const router = inject(Router);
    this.currentUrl.set(router.url);
    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        // On small screens the drawer covers the page, so it closes once a page is chosen.
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

  private loadAccess(): void {
    this.gitHubAccess.load().subscribe({
      next: (access) => this.access.set(access),
      // The team links and the banner are extras; without them the rest of the app still works.
      error: () => this.access.set(undefined),
    });
  }
}
