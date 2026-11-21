import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { Sidenav } from './sidenav';

describe('Sidenav', () => {
  let component: Sidenav;
  let fixture: ComponentFixture<Sidenav>;

  async function render(token: string | null) {
    localStorage.clear();
    if (token) {
      localStorage.setItem('token', token);
    }
    await TestBed.configureTestingModule({
      imports: [Sidenav],
      providers: [provideHttpClient(), provideRouter([])],
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
    await render(null);
    expect(component).toBeTruthy();
  });

  it('shows Login when logged out', async () => {
    const element = await render(null);
    expect(navLabels(element)).toEqual(['Home', 'Login']);
  });

  it('shows Profile and Logout when logged in', async () => {
    const element = await render('abc');
    expect(navLabels(element)).toEqual(['Home', 'Profile', 'Logout']);
  });
});
