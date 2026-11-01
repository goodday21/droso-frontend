import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SHOWN_EMAIL_MAX, shortenEmail } from './shorten-email';

/**
 * The widest email that the header can show, in CSS: as many of the widest lowercase letter, `m`,
 * as {@link shortenEmail} keeps (the backend lowers emails).
 */
const WIDEST_EMAIL = `"${'m'.repeat(SHOWN_EMAIL_MAX)}"`;

/**
 * The email of the signed-in user in the header, after an avatar with its first letter: plain
 * text, cut to 20 characters by {@link shortenEmail}, with the full email on hover when it is cut.
 *
 * The box has a fixed width, so that it keeps its place while `/me` is pending and for any email;
 * the avatar and the text sit at its right edge, next to the role (`HeaderRoleComponent`), so that
 * they read as one line. The width is that of {@link WIDEST_EMAIL} in the font of the page and of
 * the avatar: a hidden `::before` holds it in the same cell of the grid as the line, so it fits any
 * font, and being generated content it is neither in the text of the element nor read out. The
 * letter of the avatar is generated content as well, so the text of the element is the email.
 */
@Component({
  selector: 'app-header-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.title]': 'cut() ? email() : null', '[style.--widest]': 'widest' },
  template: `
    <span class="line">
      @if (letter(); as letter) {
        <span class="avatar" aria-hidden="true" [attr.data-letter]="letter"></span>
      }
      <span class="text">{{ shown() }}</span>
    </span>
  `,
  styles: [
    `
      :host {
        --avatar: 1.75rem;
        --gap: 0.5rem;
        display: inline-grid;
        flex: none;
        align-items: center;
        justify-items: end;
        white-space: nowrap;
      }
      :host::before {
        content: var(--widest);
        visibility: hidden;
        padding-left: calc(var(--avatar) + var(--gap));
      }
      :host::before,
      .line {
        grid-area: 1 / 1;
      }
      .line {
        display: flex;
        align-items: center;
        gap: var(--gap);
      }
      .avatar {
        display: grid;
        flex: none;
        place-items: center;
        width: var(--avatar);
        height: var(--avatar);
        border-radius: 50%;
        background: var(--tui-background-accent-2);
        color: var(--tui-text-primary-on-accent-2);
        font: var(--tui-typography-ui-s);
        font-weight: bold;
      }
      .avatar::before {
        content: attr(data-letter);
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

  /** The first letter of the email for the avatar; `null` while there is no email. */
  protected readonly letter = computed(() => this.email()?.charAt(0).toUpperCase() || null);

  protected readonly cut = computed(() => this.email() !== null && this.shown() !== this.email());
}
