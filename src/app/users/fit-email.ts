const ELLIPSIS = '…';

/**
 * The email cut to a width, the ellipsis included; one that fits as it is. `measure` gives the
 * width of a text in the font of the box.
 *
 * As in the header (`shortenEmail`), the domain is kept whole and the end of the local part gives
 * way: `qwe.very.long.na…@gmail.com`, but as many characters are kept as the width takes. When not
 * even one character of the local part fits before the domain, the end of the whole email is cut.
 *
 * Characters are counted as code points, so that a pair of surrogates is never split.
 */
export function fitEmail(email: string, width: number, measure: (text: string) => number): string {
  if (measure(email) <= width) {
    return email;
  }
  const chars = Array.from(email);
  const at = chars.lastIndexOf('@');
  if (at > 0) {
    const domain = ELLIPSIS + chars.slice(at).join('');
    const kept = longestFit(at, (count) => measure(chars.slice(0, count).join('') + domain) <= width);
    if (kept >= 1) {
      return chars.slice(0, kept).join('') + domain;
    }
  }
  const kept = longestFit(chars.length - 1, (count) => measure(chars.slice(0, count).join('') + ELLIPSIS) <= width);
  return chars.slice(0, kept).join('') + ELLIPSIS;
}

/** The largest count in 0..max that fits, by a binary search: the width grows with the count. */
function longestFit(max: number, fits: (count: number) => boolean): number {
  let low = 0;
  let high = max;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}
