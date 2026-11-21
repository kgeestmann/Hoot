import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { API_URL } from '../../api';
import { Login } from './login';

describe('Login', () => {
  async function render(queryParams: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('links to the GitHub sign-in on the backend', async () => {
    const link = (await render()).querySelector<HTMLAnchorElement>('a.github-button');

    expect(link?.getAttribute('href')).toBe(`${API_URL}/auth/github/login`);
    expect(link?.textContent?.trim()).toBe('Sign in with GitHub');
  });

  it('shows no error by default', async () => {
    expect((await render()).querySelector('[role=alert]')).toBeNull();
  });

  it('explains a failed GitHub sign-in', async () => {
    const alert = (await render({ error: 'github' })).querySelector('[role=alert]');

    expect(alert?.textContent).toContain('Please try again');
  });
});
