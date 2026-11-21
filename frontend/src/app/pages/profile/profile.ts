import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AuthService } from '../../services/auth';
import { UiCardComponent } from '../../layout/ui-card/ui-card';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [UiCardComponent],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./profile.css'],
})
export class Profile {
  readonly user = inject(AuthService).user;
}
