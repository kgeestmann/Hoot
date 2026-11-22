import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InstallBanner } from './install-banner';

describe('InstallBanner', () => {
  it('explains the empty lists and links to the install page and GitHub access', async () => {
    await TestBed.configureTestingModule({
      imports: [InstallBanner],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(InstallBanner);
    fixture.componentRef.setInput('installUrl', 'https://github.com/apps/hoot/installations/new');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain("Hoot can't see any of your repositories yet.");
    expect(element.querySelector<HTMLAnchorElement>('.install-link')?.href).toBe(
      'https://github.com/apps/hoot/installations/new',
    );
    expect(
      Array.from(element.querySelectorAll('a')).map((link) => link.getAttribute('href')),
    ).toContain('/github-access');
  });
});
