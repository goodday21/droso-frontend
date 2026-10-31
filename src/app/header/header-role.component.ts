import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Role } from '../auth/auth.model';

/**
 * The role of the signed-in user in the header, as `(MANAGER)`.
 *
 * The box is as wide as its text, which is always shown whole: it never shrinks nor wraps. It sits
 * right after the email (`HeaderEmailComponent`), so that the two read as one line, and right
 * before *Sign out*; empty while `/me` is pending.
 */
@Component({
  selector: 'app-header-role',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ role() === null ? '' : '(' + role() + ')' }}`,
  styles: [
    `
      :host {
        flex: none;
        white-space: nowrap;
      }
    `,
  ],
})
export class HeaderRoleComponent {
  /** `null` until `/me` has answered. */
  readonly role = input.required<Role | null>();
}
