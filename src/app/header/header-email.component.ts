import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { shortenEmail } from './shorten-email';

/**
 * The email of the signed-in user in the header: plain text, cut to 20 characters by
 * {@link shortenEmail}, with the full email on hover when it is cut.
 *
 * The box has a fixed width, so that it keeps its place while `/me` is pending and for any email;
 * the text sits at its right edge, next to the role (`HeaderRoleComponent`), so that the two read
 * as one line. The width fits 20 of the widest lowercase letter, `m` (the backend lowers emails).
 */
@Component({
  selector: 'app-header-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.title]': 'cut() ? email() : null' },
  template: `{{ shown() }}`,
  styles: [
    `
      :host {
        display: inline-block;
        flex: none;
        width: 17.5rem;
        text-align: right;
        white-space: nowrap;
        /* One line even while empty, so that the box does not move once the text comes. */
        min-height: 1lh;
      }
    `,
  ],
})
export class HeaderEmailComponent {
  /** `null` until `/me` has answered. */
  readonly email = input.required<string | null>();

  protected readonly shown = computed(() => {
    const email = this.email();
    return email === null ? '' : shortenEmail(email);
  });

  protected readonly cut = computed(() => this.email() !== null && this.shown() !== this.email());
}
