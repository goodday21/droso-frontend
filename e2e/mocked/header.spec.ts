import { Locator, Page } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser } from '../support/responses';
import { seedSession } from '../support/session';

// What the header holds and in which order, how the email is cut and that the full one is its
// hint, are checked by the specs of `AppComponent` and of the components of the header. Here only
// the layout, which needs a browser.

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

test('shows the email and the role as one line, in boxes that keep their places', async ({ page, api }) => {
  await seedSignedIn(page);
  const release = api.hold('GET /auth/me', currentUser('USER', 'qwe@gmail.com'));
  const header = new AppHeader(page);

  await page.goto('/');
  await expect(header.signOut).toBeVisible();
  const pending = { email: await header.email.boundingBox(), role: await header.role.boundingBox() };
  release();
  await expect(header.role).toHaveText('(USER)');

  const email = await boxAndText(header.email);
  const role = await boxAndText(header.role);
  expect(await header.email.boundingBox(), 'the email box while /me was pending').toEqual(pending.email);
  expect(await header.role.boundingBox(), 'the role box while /me was pending').toEqual(pending.role);
  expect(email.text.right).toBeCloseTo(email.box.right, 0);
  expect(role.text.left).toBeCloseTo(role.box.left, 0);
  // About one space between the end of the email and the start of the role.
  expect(role.text.left - email.text.right).toBeGreaterThan(0);
  expect(role.text.left - email.text.right).toBeLessThan(8);
});

test('keeps the tab, the email, the role and Sign out in a row within the page', async ({ page, api }) => {
  await seedSignedIn(page);
  // The widest lowercase letter: the backend lowers emails, so no cut email is wider than this one.
  api.respond('GET /auth/me', currentUser('MANAGER', `${'m'.repeat(40)}@mmmmmmmmmmmm.mm`));
  const header = new AppHeader(page);

  await page.goto('/');
  await expect(header.role).toHaveText('(MANAGER)');

  for (const box of [header.email, header.role]) {
    const fits = await box.evaluate((element) => element.scrollWidth <= element.clientWidth);
    expect(fits, `the text of ${await box.evaluate((element) => element.tagName)} fits its box`).toBe(true);
  }
  const tab = (await header.profileTab.boundingBox())!;
  const email = (await header.email.boundingBox())!;
  const role = (await header.role.boundingBox())!;
  const signOut = (await header.signOut.boundingBox())!;
  const main = (await page.locator('main').boundingBox())!;
  expect(email.y, 'one row').toBeCloseTo(role.y, 0);
  expect(tab.x + tab.width).toBeLessThanOrEqual(email.x);
  expect(email.x + email.width).toBeLessThanOrEqual(role.x);
  expect(role.x + role.width).toBeLessThanOrEqual(signOut.x);
  expect(signOut.x + signOut.width).toBeCloseTo(main.x + main.width, 0);
});

test('keeps Sign in and Sign up on the right without a session', async ({ page }) => {
  const header = new AppHeader(page);

  await page.goto('/');

  const bar = (await page.locator('header').boundingBox())!;
  const signUp = (await header.signUp.boundingBox())!;
  expect(signUp.x + signUp.width).toBeCloseTo(bar.x + bar.width, 0);
});
