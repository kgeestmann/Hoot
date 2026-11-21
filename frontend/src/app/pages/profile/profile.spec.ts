import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../services/auth';
import { Profile } from './profile';

describe('Profile', () => {
  it('shows the logged-in user', async () => {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 1, email: 'test@example.com' }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile);
    await fixture.whenStable();

    const values = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.value'),
    ).map((value) => value.textContent!.trim());
    expect(values).toEqual(['1', 'test@example.com']);
  });
});
