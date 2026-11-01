import { fitEmail } from './fit-email';

describe('fitEmail', () => {
  // Every character 10 wide, so that a width counts characters.
  const measure = (text: string): number => Array.from(text).length * 10;

  it('keeps an email that fits', () => {
    expect(fitEmail('qwe@gmail.com', 130, measure)).toBe('qwe@gmail.com');
    expect(fitEmail('qwe@gmail.com', 500, measure)).toBe('qwe@gmail.com');
  });

  it('cuts the end of the local part, keeping as much of it as the width takes, and the domain whole', () => {
    expect(fitEmail('qwe.very.long.name@gmail.com', 200, measure)).toBe('qwe.very.…@gmail.com');
    expect(fitEmail('qwe.very.long.name@gmail.com', 270, measure)).toBe('qwe.very.long.na…@gmail.com');
    expect(fitEmail('qwe.very.long.name@gmail.com', 279, measure)).toBe('qwe.very.long.na…@gmail.com');
  });

  it('keeps one character of the local part at the least', () => {
    expect(fitEmail('qwe.very.long.name@gmail.com', 120, measure)).toBe('q…@gmail.com');
  });

  it('cuts the end of the whole email when the domain leaves no place to the local part', () => {
    expect(fitEmail('qwe.very.long.name@gmail.com', 110, measure)).toBe('qwe.very.l…');
    expect(fitEmail('qwe@gmail.com', 5, measure)).toBe('…');
  });

  it('cuts at the last @, and cuts an email without one at its end', () => {
    expect(fitEmail('"a@b.c.d"@example.com', 170, measure)).toBe('"a@b…@example.com');
    expect(fitEmail('no-at-in-it', 60, measure)).toBe('no-at…');
  });

  it('never splits a pair of surrogates', () => {
    expect(fitEmail('😀😀😀😀@gmail.com', 130, measure)).toBe('😀😀…@gmail.com');
  });
});
