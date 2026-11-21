import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../services/auth';
import { Sidenav } from './sidenav';

describe('Sidenav', () => {
  let component: Sidenav;
  let fixture: ComponentFixture<Sidenav>;

  async function render(loggedIn: boolean) {
    await TestBed.configureTestingModule({
      imports: [Sidenav],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn), logout: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidenav);
    component = fixture.componentInstance;
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function navLabels(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.nav-btn')).map((link) => link.textContent!.trim());
  }

  it('should create', async () => {
    await render(false);
    expect(component).toBeTruthy();
  });

  it('shows Login when logged out', async () => {
    const element = await render(false);
    expect(navLabels(element)).toEqual(['Login']);
  });

  it('shows Overview, Profile and Logout when logged in', async () => {
    const element = await render(true);
    expect(navLabels(element)).toEqual(['Overview', 'Profile', 'Logout']);
  });
});
