import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SHOWN_EMAIL_MAX, shortenEmail } from './shorten-email';

/**
 * The widest email that the header can show, in CSS: as many of the widest lowercase letter, `m`,
 * as {@link shortenEmail} keeps (the backend lowers emails).
 */
const WIDEST_EMAIL = `"${'m'.repeat(SHOWN_EMAIL_MAX)}"`;

/**
 * The email of the signed-in user in the header: plain text, cut to 20 characters by
 * {@link shortenEmail}, with the full email on hover when it is cut.
 *
 * The box has a fixed width, so that it keeps its place while `/me` is pending and for any email;
 * the text sits at its right edge, next to the role (`HeaderRoleComponent`), so that the two read
 * as one line. The width is that of {@link WIDEST_EMAIL} in the font of the page: a hidden
 * `::before` holds it in the same cell of the grid as the text, so it fits any font, and being
 * generated content it is neither in the text of the element nor read out.
 */
@Component({
  selector: 'app-header-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.title]': 'cut() ? email() : null', '[style.--widest]': 'widest' },
  template: `<span class="text">{{ shown() }}</span>`,
  styles: [
    `
      :host {
        display: inline-grid;
        flex: none;
        justify-items: end;
        white-space: nowrap;
      }
      :host::before {
        content: var(--widest);
        visibility: hidden;
      }
      :host::before,
      .text {
        grid-area: 1 / 1;
      }
    `,
  ],
})
export class HeaderEmailComponent {
  /** `null` until `/me` has answered. */
  readonly email = input.required<string | null>();

  protected readonly widest = WIDEST_EMAIL;

  protected readonly shown = computed(() => {
    const email = this.email();
    return email === null ? '' : shortenEmail(email);
  });

  protected readonly cut = computed(() => this.email() !== null && this.shown() !== this.email());
}
