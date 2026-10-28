import { Page } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { AuthApiMock } from '../support/auth-api';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, loggedIn } from '../support/responses';
import { readSession, seedSession } from '../support/session';

async function signIn(page: Page, api: AuthApiMock): Promise<void> {
  api.respond('login', loggedIn());
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
}

test.describe('Session', () => {
  test('is forgotten on a sign-out', async ({ page, api }) => {
    await signIn(page, api);
    const header = new AppHeader(page);

    await header.signOut.click();

    await expectSignedOut(header);
    expect(await readSession(page)).toBeNull();
  });

  test('survives a reload and is shared by a new tab', async ({ page, context, api }) => {
    await signIn(page, api);

    await page.reload();
    await expect(new AppHeader(page).signOut).toBeVisible();

    const other = await context.newPage();
    await other.goto('/');
    await expect(new AppHeader(other).signOut).toBeVisible();
  });

  test('ends in every tab on a sign-out in one of them', async ({ page, context, api }) => {
    await signIn(page, api);
    const other = await context.newPage();
    await other.goto('/');
    await expect(new AppHeader(other).signOut).toBeVisible();

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
