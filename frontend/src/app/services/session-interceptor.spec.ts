import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { API_URL } from '../api';
import { AuthService } from './auth';
import { sessionInterceptor } from './session-interceptor';

describe('sessionInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    controller.verify();
  });

  function ignoreErrors() {
    return { error: () => undefined };
  }

  it('sends the session cookie with backend requests', () => {
    http.get(`${API_URL}/profile`).subscribe(ignoreErrors());

    expect(controller.expectOne(`${API_URL}/profile`).request.withCredentials).toBe(true);
  });

  it('does not send cookies to other hosts', () => {
    http.get('https://example.com/data').subscribe(ignoreErrors());

    expect(controller.expectOne('https://example.com/data').request.withCredentials).toBe(false);
  });

  it('sends the user to /login when the session expires', () => {
    auth.loadSession().subscribe();
    controller.expectOne(`${API_URL}/profile`).flush({ id: 1, login: 'octocat' });

    http.get(`${API_URL}/overview`).subscribe(ignoreErrors());
    controller
      .expectOne(`${API_URL}/overview`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('leaves a 401 alone when nobody is logged in', () => {
    http.get(`${API_URL}/profile`).subscribe(ignoreErrors());
    controller
      .expectOne(`${API_URL}/profile`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });
});
