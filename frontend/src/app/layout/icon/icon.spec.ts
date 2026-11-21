import { TestBed } from '@angular/core/testing';

import { Icon } from './icon';

describe('Icon', () => {
  async function render(name: string) {
    await TestBed.configureTestingModule({ imports: [Icon] }).compileComponents();
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', name);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the named Material Symbol', async () => {
    const element = await render('check');

    expect(element.querySelector('path')?.getAttribute('d')).toBe(
      'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z',
    );
  });

  it('is hidden from screen readers, since the text next to it carries the meaning', async () => {
    const element = await render('close');

    expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
