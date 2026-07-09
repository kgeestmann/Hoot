import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { UiCardComponent } from '../../layout/ui-card/ui-card';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, UiCardComponent],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class Profile implements OnInit {

  user: any;

  constructor(public auth: AuthService) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.auth.getProfile().subscribe(res => {
      this.user = res;
    });
  }
}