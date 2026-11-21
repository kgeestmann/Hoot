import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Material Symbols Outlined, weight 400, 24 px (viewBox 0 -960 960 960), from
 * github.com/google/material-design-icons (Apache 2.0).
 */
const PATHS = {
  check: 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z',
  close:
    'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z',
  menu: 'M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z',
  schedule:
    'm612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z',
} as const;

export type IconName = keyof typeof PATHS;

/** A decorative icon in the current text colour; the text next to it carries the meaning. */
@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 -960 960 960" aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: var(--hoot-icon-size, 24px);
      height: var(--hoot-icon-size, 24px);
      flex: none;
    }

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly path = computed(() => PATHS[this.name()]);
}
