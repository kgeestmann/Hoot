import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { API_URL } from '../../api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login.css'],
})
export class Login {
  /** A full page navigation: the backend redirects on to GitHub and back. */
  readonly signInUrl = `${API_URL}/auth/github/login`;
  /** The backend sends the browser back with ?error=github when the sign-in failed. */
  readonly signInFailed = inject(ActivatedRoute).snapshot.queryParamMap.get('error') === 'github';
}
