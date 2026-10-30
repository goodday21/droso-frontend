import { Page } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { ApiMock } from '../support/api-mock';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser, loggedIn } from '../support/responses';
import { readSession, seedSession } from '../support/session';

async function signIn(page: Page, api: ApiMock): Promise<void> {
  api.respond('POST /auth/login', loggedIn());
  api.respond('GET /auth/me', currentUser('MANAGER'));
  const login = new LoginPage(page);
  await login.open();
  await login.fill('qwe@gmail.com', 'Sup3r-Secret!');
  await login.submit.click();
  await expect(page).toHaveURL('/');
}

async function expectSignedOut(header: AppHeader): Promise<void> {
  await expect(header.signIn).toBeVisible();
  await expect(header.signUp).toBeVisible();
  await expect(header.signOut).toBeHidden();
  await expect(header.role).toBeHidden();
}

async function expectSignedIn(header: AppHeader): Promise<void> {
  await expect(header.role).toHaveText('Role: MANAGER');
  await expect(header.signOut).toBeVisible();
}

test.describe('Session', () => {
  test('is forgotten on a sign-out', async ({ page, api }) => {
    await signIn(page, api);
    const header = new AppHeader(page);

    await header.signOut.click();

    await expectSignedOut(header);
    expect(await readSession(page)).toBeNull();
  });

  test('survives a reload and is shared by a new tab, with the role of the user', async ({ page, context, api }) => {
    await signIn(page, api);
    await expectSignedIn(new AppHeader(page));

    await page.reload();
    await expectSignedIn(new AppHeader(page));

    const other = await context.newPage();
    await other.goto('/');
    await expectSignedIn(new AppHeader(other));
  });

  test('ends in every tab on a sign-out in one of them', async ({ page, context, api }) => {
    await signIn(page, api);
    const other = await context.newPage();
    await other.goto('/');
    await expectSignedIn(new AppHeader(other));

    await new AppHeader(other).signOut.click();

    // No reload: the first tab learns it from the `storage` event.
    await expectSignedOut(new AppHeader(page));
  });

  test('is ignored once the token has expired', async ({ page }) => {
    await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() - 1000 });

    await page.goto('/');

    await expectSignedOut(new AppHeader(page));
  });
});

test('links lead between the pages', async ({ page }) => {
  const header = new AppHeader(page);
  const register = new RegisterPage(page);
  const login = new LoginPage(page);
  await page.goto('/');

  await header.signUp.click();
  await expect(page).toHaveURL('/register');
  await expect(page).toHaveTitle('Sign up');
  await expect(register.heading).toHaveText('Sign up');

  await register.switchLink.click();
  await expect(page).toHaveURL('/login');
  await expect(page).toHaveTitle('Sign in');
  await expect(login.heading).toHaveText('Sign in');

  await login.switchLink.click();
  await expect(page).toHaveURL('/register');

  await header.signIn.click();
  await expect(page).toHaveURL('/login');

  await header.serviceHealth.click();
  await expect(page).toHaveURL('/');
  await expect(page).toHaveTitle('Service health');
});
