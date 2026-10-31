import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Role } from '../auth/auth.model';

/**
 * The role of the signed-in user in the header, as `(MANAGER)`.
 *
 * The box has a fixed width, so that it keeps its place for any role and while `/me` is pending;
 * the text sits at its left edge, next to the email (`HeaderEmailComponent`). The width is that of
 * the longest role, `(MANAGER)`, in the font of the page: a hidden `::before` holds it in the same
 * cell of the grid as the text, and being generated content it is neither in the text of the
 * element nor read out. A longer role added to `Role` needs its name there.
 */
@Component({
  selector: 'app-header-role',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="text">{{ role() === null ? '' : '(' + role() + ')' }}</span>`,
  styles: [
    `
      :host {
        display: inline-grid;
        flex: none;
        justify-items: start;
        white-space: nowrap;
      }
      :host::before {
        content: '(MANAGER)';
        visibility: hidden;
      }
      :host::before,
      .text {
        grid-area: 1 / 1;
      }
    `,
  ],
})
export class HeaderRoleComponent {
  /** `null` until `/me` has answered. */
  readonly role = input.required<Role | null>();
}
