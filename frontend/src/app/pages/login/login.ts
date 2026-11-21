import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { API_URL } from '../../api';
import { UiCardComponent } from '../../layout/ui-card/ui-card';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [UiCardComponent],
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
