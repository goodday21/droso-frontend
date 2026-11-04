import { Page } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { ApiMock } from '../support/api-mock';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, REFRESHED_TOKEN, currentUser, loggedIn, loggedOut, refreshed } from '../support/responses/auth';
import { apiError } from '../support/responses/errors';
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
  await expect(header.role).toHaveText('MANAGER');
  await expect(header.signOut).toBeVisible();
}

test.describe('Session', () => {
  test('is forgotten on a sign-out, which revokes the refresh cookie and opens the sign-in', { tag: '@E2E-030' }, async ({ page, api }) => {
    await signIn(page, api);
    api.respond('POST /auth/logout', loggedOut());
    const header = new AppHeader(page);

    await header.signOut.click();

    await expect(page).toHaveURL('/login');
    await expectSignedOut(header);
    expect(await readSession(page)).toBeNull();
    await expect.poll(() => api.requests('POST /auth/logout').length).toBe(1);
  });

  test('survives a reload and is shared by a new tab, with the role of the user', { tag: '@E2E-031' }, async ({ page, context, api }) => {
    await signIn(page, api);
    await expectSignedIn(new AppHeader(page));

    await page.reload();
    await expectSignedIn(new AppHeader(page));

    const other = await context.newPage();
    await other.goto('/');
    await expectSignedIn(new AppHeader(other));
  });

  test('ends in every tab on a sign-out in one of them, which all open the sign-in', { tag: '@E2E-032' }, async ({ page, context, api }) => {
    await signIn(page, api);
    api.respond('POST /auth/logout', loggedOut());
    const other = await context.newPage();
    await other.goto('/');
    await expectSignedIn(new AppHeader(other));

    await new AppHeader(other).signOut.click();

    // No reload: the first tab learns it from the `storage` event.
    await expect(page).toHaveURL('/login');
    await expectSignedOut(new AppHeader(page));
  });

  test('is renewed at the start from the refresh cookie when the token has expired', { tag: '@E2E-033' }, async ({ page, api }) => {
    await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() - 1000 });
    api.respond('POST /auth/refresh', refreshed());
    api.respond('GET /auth/me', currentUser('MANAGER'));

    await page.goto('/');

    await expectSignedIn(new AppHeader(page));
    expect((await readSession(page))?.accessToken).toBe(REFRESHED_TOKEN);
  });

  test('stays ended when the refresh cookie is refused at the start', { tag: '@E2E-034' }, async ({ page, api }) => {
    await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() - 1000 });

    await page.goto('/');

    await expectSignedOut(new AppHeader(page));
    await expect(page).toHaveURL('/');
    expect(api.requests('POST /auth/refresh')).toHaveLength(1);
  });

  test('is renewed once for two tabs whose token expired at the same time', { tag: '@E2E-035' }, async ({ page, context, api }) => {
    const expired = { accessToken: ACCESS_TOKEN, expiresAt: Date.now() - 1000 };
    const other = await context.newPage();
    await seedSession(page, expired);
    await seedSession(other, expired);
    const release = api.hold('POST /auth/refresh', refreshed());
    api.respond('GET /auth/me', currentUser('MANAGER'));

    await page.goto('/');
    await other.goto('/');
    await expect.poll(() => api.requests('POST /auth/refresh').length).toBe(1);
    release();

    // The second tab waits for the lock, then takes the token of the first one.
    await expectSignedIn(new AppHeader(page));
    await expectSignedIn(new AppHeader(other));
    expect(api.requests('POST /auth/refresh')).toHaveLength(1);
  });

  test('ends with a notice when the backend rejects the token even after a refresh', { tag: '@E2E-036' }, async ({ page, api }) => {
    await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() + 900_000 });
    api.respond('GET /auth/me', apiError(401, 'UNAUTHORIZED'));
    api.respond('POST /auth/refresh', refreshed());

    await page.goto('/');

    await expect(page).toHaveURL('/login?expired=1');
    // Its wording is checked by the spec of the page.
    await expect(new LoginPage(page).expired).toBeVisible();
    await expectSignedOut(new AppHeader(page));
    expect(api.requests('POST /auth/refresh')).toHaveLength(1);
  });
});

test('links lead between the pages', { tag: '@E2E-037' }, async ({ page }) => {
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
});
