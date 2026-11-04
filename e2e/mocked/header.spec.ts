import { Locator, Page } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser } from '../support/responses/auth';
import { seedSession } from '../support/session';

// What the header holds and in which order, how the email is cut and that the full one is its
// hint, are checked by the specs of `AppComponent` and of the components of the header. Here only
// the layout, which needs a browser.

/** The right edge of the content of the header: the account ends there, before its padding. */
async function headerEnd(page: Page): Promise<number> {
  return page.locator('header').evaluate((header) => {
    return header.getBoundingClientRect().right - parseFloat(getComputedStyle(header).paddingRight);
  });
}

/** The box of the element and the extent of its text, in pixels of the page. */
async function boxAndText(locator: Locator): Promise<{ box: DOMRect; text: DOMRect }> {
  return locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return { box: element.getBoundingClientRect().toJSON(), text: range.getBoundingClientRect().toJSON() };
  });
}

async function seedSignedIn(page: Page): Promise<void> {
  await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() + 1800_000 });
}

test('shows the email and the role as one line, the role as wide as its badge, before Sign out', { tag: '@E2E-015' }, async ({
  page,
  api,
}) => {
  await seedSignedIn(page);
  const release = api.hold('GET /auth/me', currentUser('USER', 'qwe@gmail.com'));
  const header = new AppHeader(page);

  await page.goto('/');
  await expect(header.signOut).toBeVisible();
  const pending = { email: (await header.email.boundingBox())!, signOut: await header.signOut.boundingBox() };
  release();
  await expect(header.role).toHaveText('USER');

  const email = await boxAndText(header.email);
  const avatar = (await header.email.locator('.avatar').boundingBox())!;
  const role = await boxAndText(header.role);
  const signOut = (await header.signOut.boundingBox())!;
  expect(signOut, 'Sign out stays where it was while /me was pending').toEqual(pending.signOut);
  expect(email.box.width, 'the width of the email box').toBeCloseTo(pending.email.width, 0);
  expect(email.text.right).toBeCloseTo(email.box.right, 0);
  // The avatar right before the text of the email, the gap of the line (0.5rem) apart.
  const text = await header.email.locator('.text').boundingBox();
  expect(text!.x - (avatar.x + avatar.width)).toBeCloseTo(8, 0);
  expect(role.text.left).toBeCloseTo(role.box.left, 0);
  expect(role.text.right).toBeCloseTo(role.box.right, 0);
  // The gap of the line (0.5rem) between the end of the email and the badge of the role.
  expect(role.text.left - email.text.right).toBeCloseTo(8, 0);
  // No empty place after the role: only the gap of the header (1rem) before Sign out.
  expect(signOut.x - role.box.right).toBeCloseTo(16, 0);
});

test('keeps the tab, the email, the role and Sign out in a row within the page', { tag: '@E2E-016' }, async ({ page, api }) => {
  await seedSignedIn(page);
  // The widest lowercase letter: the backend lowers emails, so no cut email is wider than this one.
  api.respond('GET /auth/me', currentUser('MANAGER', `${'m'.repeat(40)}@mmmmmmmmmmmm.mm`));
  const header = new AppHeader(page);

  await page.goto('/');
  await expect(header.role).toHaveText('MANAGER');

  // The longest role, as the widest email: both are shown whole.
  for (const box of [header.email, header.role]) {
    const fits = await box.evaluate((element) => element.scrollWidth <= element.clientWidth);
    expect(fits, `the text of ${await box.evaluate((element) => element.tagName)} fits its box`).toBe(true);
  }
  const tab = (await header.profileTab.boundingBox())!;
  const email = (await header.email.boundingBox())!;
  const role = (await header.role.boundingBox())!;
  const signOut = (await header.signOut.boundingBox())!;
  expect(email.y + email.height / 2, 'one row').toBeCloseTo(role.y + role.height / 2, 0);
  expect(tab.x + tab.width).toBeLessThanOrEqual(email.x);
  expect(email.x + email.width).toBeLessThanOrEqual(role.x);
  expect(role.x + role.width).toBeLessThanOrEqual(signOut.x);
  expect(signOut.x + signOut.width).toBeCloseTo(await headerEnd(page), 0);
});

test('keeps Sign in and Sign up on the right without a session', { tag: '@E2E-017' }, async ({ page }) => {
  const header = new AppHeader(page);

  await page.goto('/');

  const signUp = (await header.signUp.boundingBox())!;
  expect(signUp.x + signUp.width).toBeCloseTo(await headerEnd(page), 0);
});
