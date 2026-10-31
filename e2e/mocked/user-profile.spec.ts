import { AppHeader } from '../pages/app-header';
import { UserProfilePage } from '../pages/user-profile-page';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser, loggedOut } from '../support/responses';
import { readSession, seedSession } from '../support/session';

// What the page shows for each answer, and the dialog's ways out, are checked by the spec of the
// page; that a guest is sent to the sign-in, by `app.routes.spec.ts`. Here the navigation, the
// history of the tab, the place of the dialog on the screen and the tabs.

test.describe('User profile', () => {
  test.beforeEach(async ({ page, api }) => {
    await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() + 900_000 });
    api.respond('GET /auth/me', currentUser('MANAGER'));
  });

  test('opens from the link of the header, without the header itself, and Back returns', async ({ page }) => {
    const profile = new UserProfilePage(page);
    await page.goto('/');

    await new AppHeader(page).email.click();

    await expect(page).toHaveURL('/user-profile');
    await expect(page).toHaveTitle('User profile');
    await expect(profile.heading).toHaveText('User profile');
    await expect(page.locator('nav')).toHaveCount(0);

    await profile.back.click();

    await expect(page).toHaveURL('/');
    await expect(new AppHeader(page).role).toHaveText('Role: MANAGER');
  });

  test('Back opens the root when the page was opened directly', async ({ page }) => {
    const profile = new UserProfilePage(page);
    await profile.open();

    await profile.back.click();

    await expect(page).toHaveURL('/');
  });

  test('closes the dialog on a click outside it', async ({ page }) => {
    const profile = new UserProfilePage(page);
    await profile.open();
    await profile.logoutAll.click();
    await expect(profile.dialog).toBeVisible();

    // The corner of the page, far from the dialog in the middle.
    await page.mouse.click(5, 5);

    await expect(profile.dialog).toBeHidden();
  });

  test('logs out every session after a confirmation, and every tab opens the sign-in', async ({ page, context, api }) => {
    api.respond('POST /auth/logout-all', loggedOut());
    const profile = new UserProfilePage(page);
    await profile.open();
    const other = await context.newPage();
    await other.goto('/');
    await expect(new AppHeader(other).role).toHaveText('Role: MANAGER');

    await profile.logoutAll.click();
    await profile.confirm.click();

    await expect(page).toHaveURL('/login');
    await expect(other).toHaveURL('/login');
    expect(await readSession(page)).toBeNull();
    expect(api.requests('POST /auth/logout-all')).toHaveLength(1);
  });
});
