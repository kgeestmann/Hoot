import { inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** Takes each page's title from its route: shown in the top bar and as the browser tab title. */
@Injectable({
  providedIn: 'root',
})
export class PageTitle extends TitleStrategy {
  private readonly documentTitle = inject(Title);

  /** The title of the current page, e.g. "Overview"; empty before the first navigation. */
  readonly current = signal('');

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot) ?? '';
    this.current.set(title);
    this.documentTitle.setTitle(title ? `${title} · Hoot` : 'Hoot');
  }
}
