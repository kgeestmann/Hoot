import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AuthService } from '../../services/auth';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatCardModule, MatDividerModule, MatListModule],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./profile.css'],
})
export class Profile {
  readonly user = inject(AuthService).user;
}
