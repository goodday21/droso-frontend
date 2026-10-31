/** The most characters of an email that the header shows. */
export const SHOWN_EMAIL_MAX = 20;

/** The fewest characters of the local part that are worth keeping before the domain. */
const LOCAL_PART_MIN = 3;

const ELLIPSIS = '…';

/**
 * The email cut to `max` characters, the ellipsis included; a shorter one as it is.
 *
 * The domain is kept whole, as it tells the accounts of one user apart best: `qwe.very.…@gmail.com`.
 * When it leaves fewer than {@link LOCAL_PART_MIN} characters of the local part, the middle of the
 * whole email is cut instead: `ab@some-ve…ample.com`.
 *
 * Characters are counted as code points, so that a pair of surrogates is never split.
 */
export function shortenEmail(email: string, max = SHOWN_EMAIL_MAX): string {
  const chars = Array.from(email);
  if (chars.length <= max) {
    return email;
  }
  const at = chars.lastIndexOf('@');
  if (at > 0) {
    const domain = chars.slice(at);
    const kept = max - ELLIPSIS.length - domain.length;
    if (kept >= LOCAL_PART_MIN) {
      return chars.slice(0, kept).join('') + ELLIPSIS + domain.join('');
    }
  }
  const head = Math.ceil((max - ELLIPSIS.length) / 2);
  const tail = max - ELLIPSIS.length - head;
  return chars.slice(0, head).join('') + ELLIPSIS + chars.slice(chars.length - tail).join('');
}
