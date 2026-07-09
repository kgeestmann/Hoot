import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';


@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './sidenav.html',
  styleUrls: ['./sidenav.css']
})
export class Sidenav {

  constructor(public auth: AuthService) {}

  logout() {
    this.auth.logout();
  }

}