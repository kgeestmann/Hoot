import { TemplatePortal } from '@angular/cdk/portal';
import {
  Directive,
  inject,
  Injectable,
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

/** What the current page shows in the top bar after its title, such as filters and status. */
@Injectable({ providedIn: 'root' })
export class PageToolbar {
  /** Set by the app layout, which shows `portal` in its top bar. */
  hosted = false;
  readonly portal = signal<TemplatePortal | null>(null);
}

/**
 * Marks a page's `<ng-template appPageToolbar>` as its part of the top bar. Without the app
 * layout, as in a page's unit test, the template renders in place instead.
 */
@Directive({ selector: 'ng-template[appPageToolbar]' })
export class PageToolbarContent implements OnInit, OnDestroy {
  private readonly toolbar = inject(PageToolbar);
  private readonly template = inject(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);
  private portal?: TemplatePortal;

  ngOnInit(): void {
    if (!this.toolbar.hosted) {
      this.viewContainer.createEmbeddedView(this.template);
      return;
    }
    this.portal = new TemplatePortal(this.template, this.viewContainer);
    this.toolbar.portal.set(this.portal);
  }

  /** Clears the top bar, unless the next page has already put its own content there. */
  ngOnDestroy(): void {
    if (this.portal && this.toolbar.portal() === this.portal) {
      this.toolbar.portal.set(null);
    }
  }
}
