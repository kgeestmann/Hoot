import { Component, ChangeDetectionStrategy, inject } from '@angular/core';

import { AuthService } from '../../services/auth';
import { GitHubAccessCard } from './github-access/github-access';

@Component({
  selector: 'app-home',
  imports: [GitHubAccessCard],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home.css',
})
export class Home {
  readonly isLoggedIn = inject(AuthService).isLoggedIn;
}
