import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
 
  private apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);

    return this.http.post<any>(
      `${this.apiUrl}/login`,
      body.toString(),
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded'
        })
      }
    );
  }

  getProfile() {
    const token = localStorage.getItem('token');

    return this.http.get<any>(`${this.apiUrl}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  saveToken(token: string) {
    localStorage.setItem('token', token);
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }
}