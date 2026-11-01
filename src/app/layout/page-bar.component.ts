import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

/**
 * The bar of a page below the header of the application: *Back* on the left and the title of the
 * page in the middle.
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
  template: `
    <button type="button" class="back" (click)="back()">← Back</button>
    <h1>{{ title() }}</h1>
  `,
  styles: [
    `
      :host {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 1rem;
      }
      /* The third column stays empty, so that the title is in the middle of the page. */
      .back {
        justify-self: start;
        font: inherit;
        padding: 0.5rem 1.25rem;
      }
      h1 {
        margin: 1rem 0;
        text-align: center;
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
