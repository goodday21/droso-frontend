import { EMAIL_MAX_LENGTH } from '../auth/auth.model';
import { SHOWN_EMAIL_MAX, shortenEmail } from './shorten-email';

describe('shortenEmail', () => {
  it('keeps an email of 20 characters or fewer as it is', () => {
    expect(shortenEmail('qwe@gmail.com')).toBe('qwe@gmail.com');
    expect(shortenEmail('we.very.lo@gmail.com')).toBe('we.very.lo@gmail.com');
  });

  it('cuts the local part of a longer one and keeps the domain whole', () => {
    expect(shortenEmail('qwe.very.lo@gmail.com')).toBe('qwe.very.…@gmail.com');
    expect(shortenEmail('qwe.very.long.name@gmail.com')).toBe('qwe.very.…@gmail.com');
  });

  it('keeps three characters of the local part at least', () => {
    // `@` and 15 more: 3 characters before the ellipsis.
    expect(shortenEmail('abcdef@company-mail.io')).toBe('abc…@company-mail.io');
  });

  it('cuts the middle of the whole email when the domain leaves fewer', () => {
    expect(shortenEmail('abcdef@company-mail.com')).toBe('abcdef@com…-mail.com');
    expect(shortenEmail('ab@some-very-long-domain.example.com')).toBe('ab@some-ve…ample.com');
  });

  it('cuts the middle of a value without an @', () => {
    expect(shortenEmail('a'.repeat(10) + 'b'.repeat(15))).toBe('a'.repeat(10) + '…' + 'b'.repeat(9));
  });

  it('cuts the longest email to 20 characters', () => {
    const shown = shortenEmail(`${'a'.repeat(EMAIL_MAX_LENGTH - 10)}@gmail.com`);

    expect(shown).toBe(`${'a'.repeat(9)}…@gmail.com`);
    expect(shown.length).toBe(SHOWN_EMAIL_MAX);
  });

  it('never splits a pair of surrogates', () => {
    expect(shortenEmail(`${'😀'.repeat(12)}@gmail.com`)).toBe(`${'😀'.repeat(9)}…@gmail.com`);
  });
});
