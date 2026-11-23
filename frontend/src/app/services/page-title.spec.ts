import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';

import { PageTitle } from './page-title';

@Component({ template: '' })
class EmptyPage {}

describe('PageTitle', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'profile', title: 'Profile', component: EmptyPage },
          { path: 'untitled', component: EmptyPage },
        ]),
        { provide: TitleStrategy, useExisting: PageTitle },
      ],
    });
  });

  it("takes the route's title for the top bar and the browser tab", async () => {
    await TestBed.inject(Router).navigateByUrl('/profile');

    expect(TestBed.inject(PageTitle).current()).toBe('Profile');
    expect(TestBed.inject(Title).getTitle()).toBe('Hoot: Profile');
  });

  it('falls back to Hoot for pages without a title', async () => {
    await TestBed.inject(Router).navigateByUrl('/untitled');

    expect(TestBed.inject(PageTitle).current()).toBe('');
    expect(TestBed.inject(Title).getTitle()).toBe('Hoot');
  });
});
