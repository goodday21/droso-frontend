import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';

/**
 * The bar of a page below the header of the application: *Back*, a flat button with an arrow, and
 * the title of the page under it, both on the left.
 *
 * *Back* returns to the page this one was opened from, or opens the root when it was opened
 * directly (a link, a reload): the history of the tab would leave the application then. Which of
 * the two is decided once, when the page is created, so that a change of the query of the page
 * itself (`replaceUrl`, as the pages of the list of users) does not count as a page it came from.
 */
@Component({
  selector: 'app-page-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiButton],
  template: `
    <button tuiButton type="button" appearance="flat-grayscale" size="xs" iconStart="@tui.arrow-left" (click)="back()">
      Back
    </button>
    <h1>{{ title() }}</h1>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 1rem 0 1.25rem;
      }
      /* The arrow in line with the title rather than the padding of the button. */
      button {
        margin-left: -0.5rem;
      }
      h1 {
        margin: 0.25rem 0 0;
        font: var(--tui-typography-heading-h3);
        color: var(--tui-text-primary);
      }
    `,
  ],
})
export class PageBarComponent {
  readonly title = input.required<string>();

  private readonly router = inject(Router);
  private readonly location = inject(Location);

  // The page is created while the router navigates to it; outside a navigation, the last one.
  private readonly openedFromPage = !!(this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())
    ?.previousNavigation;

  back(): void {
    if (this.openedFromPage) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/');
    }
  }
}
