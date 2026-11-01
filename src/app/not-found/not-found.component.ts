import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiLink } from '@taiga-ui/core';
import { PageBarComponent } from '../layout/page-bar.component';

/**
 * Shown for every path that is not a page of the application.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageBarComponent, TuiLink],
  template: `
    <app-page-bar title="Page not found" [back]="false" />
    <p class="text">This page does not exist. <a tuiLink routerLink="/">Go to the service health</a>.</p>
  `,
  styles: [
    `
      .text {
        margin: 0;
        font: var(--tui-typography-body-l);
        color: var(--tui-text-secondary);
      }
    `,
  ],
})
export class NotFoundComponent {}
