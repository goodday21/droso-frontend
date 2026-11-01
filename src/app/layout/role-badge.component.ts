import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiBadge } from '@taiga-ui/kit';
import { Role } from '../auth/auth.model';

/**
 * The badge of each role, an appearance of the theme of Taiga UI: the administrator a solid red one,
 * the manager a solid blue one (the accent of the theme), with white text; the user a grey one.
 */
export const ROLE_APPEARANCE: Readonly<Record<Role, string>> = {
  ADMIN: 'primary-destructive',
  MANAGER: 'primary',
  USER: 'neutral',
};

/**
 * A role as a badge of its colour (`ADMIN`, `MANAGER`, `USER`), the same in the header, on the
 * profile and in the list of users. The box is as wide as its badge and never wraps.
 */
@Component({
  selector: 'app-role-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiBadge],
  template: `<span tuiBadge size="m" [appearance]="appearance()">{{ role() }}</span>`,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
        white-space: nowrap;
      }
    `,
  ],
})
export class RoleBadgeComponent {
  readonly role = input.required<Role>();

  protected readonly appearance = computed(() => ROLE_APPEARANCE[this.role()]);
}
