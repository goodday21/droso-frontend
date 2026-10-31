import { AppHeader } from '../pages/app-header';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser } from '../support/responses';
import { seedSession } from '../support/session';

// The longest email that the backend accepts (254 characters).
const LONG_EMAIL = `${'a'.repeat(244)}@gmail.com`;

test('cuts a long email and keeps the role and Sign out beside it', async ({ page, api }) => {
  await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() + 1800_000 });
  api.respond('GET /auth/me', currentUser('MANAGER', LONG_EMAIL));
  const header = new AppHeader(page);

  await page.goto('/');

  await expect(header.role).toHaveText('Role: MANAGER');
  await expect(header.signOut).toBeVisible();
  await expect(header.email).toHaveText(LONG_EMAIL);
  // The box of the email ends before the role in any case; these keep its text inside the box.
  await expect(header.email).toHaveCSS('overflow-x', 'hidden');
  await expect(header.email).toHaveCSS('white-space', 'nowrap');
  await expect(header.email).toHaveCSS('text-overflow', 'ellipsis');
  const email = await header.email.evaluate((element) => ({
    cut: element.scrollWidth > element.clientWidth,
    right: element.getBoundingClientRect().right,
  }));
  expect(email.cut, 'the email is wider than its place').toBe(true);
  const role = (await header.role.boundingBox())!;
  const signOut = (await header.signOut.boundingBox())!;
  expect(email.right).toBeLessThanOrEqual(role.x);
  expect(role.x + role.width).toBeLessThanOrEqual(signOut.x);
  expect(signOut.x + signOut.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('keeps Sign in and Sign up on the right without a session', async ({ page }) => {
  const header = new AppHeader(page);

  await page.goto('/');

  const nav = (await page.locator('nav').boundingBox())!;
  const signUp = (await header.signUp.boundingBox())!;
  expect(signUp.x + signUp.width).toBeCloseTo(nav.x + nav.width, 0);
});
