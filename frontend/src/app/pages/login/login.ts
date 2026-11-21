import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { UiButtonComponent } from '../../layout/ui-button/ui-button';
import { UiCardComponent } from '../../layout/ui-card/ui-card';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, UiButtonComponent, UiCardComponent],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login.css'],
})
export class Login {
  email = '';
  password = '';
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  onLogin() {
    this.auth.login(this.email, this.password).subscribe({
      next: (res: any) => {
        this.auth.saveToken(res.access_token);
        this.router.navigate(['/']);
      },
      error: () => {
        this.error = 'Login fehlgeschlagen';
        this.cdr.detectChanges();
      },
    });
  }
}
