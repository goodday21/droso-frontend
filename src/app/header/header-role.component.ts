import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Role } from '../auth/auth.model';

/**
 * The role of the signed-in user in the header, as `(MANAGER)`.
 *
 * The box has a fixed width, that of the longest role, so that it keeps its place for any role and
 * while `/me` is pending; the text sits at its left edge, next to the email
 * (`HeaderEmailComponent`).
 */
@Component({
  selector: 'app-header-role',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ role() === null ? '' : '(' + role() + ')' }}`,
  styles: [
    `
      :host {
        display: inline-block;
        flex: none;
        width: 5.5rem;
        text-align: left;
        white-space: nowrap;
        /* One line even while empty, so that the box does not move once the text comes. */
        min-height: 1lh;
      }
    `,
  ],
})
export class HeaderRoleComponent {
  /** `null` until `/me` has answered. */
  readonly role = input.required<Role | null>();
}
