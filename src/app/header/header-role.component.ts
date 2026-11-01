import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiBadge } from '@taiga-ui/kit';
import { Role } from '../auth/auth.model';

/**
 * The role of the signed-in user in the header, as a badge `MANAGER`.
 *
 * The box is as wide as its badge, which always shows the role whole: it never shrinks nor wraps.
 * It sits right after the email (`HeaderEmailComponent`), so that the two read as one line, and
 * right before *Sign out*; empty, without a badge, while `/me` is pending.
 */
@Component({
  selector: 'app-header-role',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiBadge],
  template: `
    @if (role(); as role) {
      <span tuiBadge appearance="neutral" size="m">{{ role }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
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
