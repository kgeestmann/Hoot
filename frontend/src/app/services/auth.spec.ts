import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { API_URL } from '../api';
import { AuthService } from './auth';

describe('AuthService', () => {
  const user = { id: 1, login: 'octocat' };
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks the backend for the session only once', () => {
    service.loadSession().subscribe();
    http.expectOne(`${API_URL}/profile`).flush(user);

    let cached: unknown;
    service.loadSession().subscribe((result) => (cached = result));

    http.expectNone(`${API_URL}/profile`);
    expect(cached).toEqual(user);
    expect(service.isLoggedIn()).toBe(true);
  });

  it('treats a rejected session as logged out', () => {
    let result: unknown = 'not set';
    service.loadSession().subscribe((loaded) => (result = loaded));

    http.expectOne(`${API_URL}/profile`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('logout ends the session on the backend and navigates to /login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    service.loadSession().subscribe();
    http.expectOne(`${API_URL}/profile`).flush(user);

    service.logout();
    http
      .expectOne({ method: 'POST', url: `${API_URL}/logout` })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(service.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
