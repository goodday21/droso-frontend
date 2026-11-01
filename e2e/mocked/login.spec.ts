import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser, loggedIn } from '../support/responses/auth';
import { apiError } from '../support/responses/errors';
import { readSession } from '../support/session';

const EMAIL = 'qwe@gmail.com';
const PASSWORD = 'Sup3r-Secret!';

test.describe('Sign-in page', () => {
  let login: LoginPage;

  test.beforeEach(async ({ page }) => {
    login = new LoginPage(page);
    await login.open();
  });

  test('requires both fields and sends nothing', async ({ api }) => {
    await login.submit.click();

    await expect(login.fieldErrors('email')).toHaveText(['is required']);
    await expect(login.fieldErrors('password')).toHaveText(['is required']);
    expect(api.requests('POST /auth/login')).toEqual([]);
  });

  test('limits the length of both fields and sends nothing', async ({ api }) => {
    await login.fill(`${'a'.repeat(245)}@gmail.com`, `${'Aa1!'.repeat(16)}x`);
    await login.submit.click();

    await expect(login.fieldErrors('email')).toHaveText(['must be at most 254 characters']);
    await expect(login.fieldErrors('password')).toHaveText(['must be at most 64 characters']);
    expect(api.requests('POST /auth/login')).toEqual([]);
  });

  test('keeps the token and opens the root page', async ({ page, api }) => {
    api.respond('POST /auth/login', loggedIn(1800));
    api.respond('GET /auth/me', currentUser());

    await login.fill(EMAIL, PASSWORD);
    const sentAfter = Date.now();
    await login.submit.click();

    await expect(page).toHaveURL('/');
    await expect(new AppHeader(page).signOut).toBeVisible();
    expect(api.requests('POST /auth/login')).toEqual([{ email: EMAIL, password: PASSWORD }]);

    const session = await readSession(page);
    expect(session?.accessToken).toBe(ACCESS_TOKEN);
    expect(session?.expiresAt).toBeGreaterThanOrEqual(sentAfter + 1800_000);
    expect(session?.expiresAt).toBeLessThanOrEqual(Date.now() + 1800_000);
  });

  test('rejects wrong credentials and clears the password', async ({ page, api }) => {
    api.respond('POST /auth/login', apiError(401, 'INVALID_CREDENTIALS'));

    await login.fill(EMAIL, 'Wr0ng-Secret!');
    await login.submit.click();

    await expect(login.alert).toHaveText('Invalid email or password.');
    await expect(login.email).toHaveValue(EMAIL);
    await expect(login.password).toHaveValue('');
    // The error belongs to neither field.
    await expect(login.fieldErrors('email')).toHaveCount(0);
    await expect(login.fieldErrors('password')).toHaveCount(0);
    expect(await readSession(page)).toBeNull();
  });

  test('sends one request while the first one is pending', async ({ page, api }) => {
    const release = api.hold('POST /auth/login', loggedIn());
    api.respond('GET /auth/me', currentUser());

    await login.fill(EMAIL, PASSWORD);
    await login.submit.click();
    await expect(login.submit).toHaveText('Signing in…');
    await expect(login.submit).toBeDisabled();

    await login.submitAgain();
    release();

    await expect(page).toHaveURL('/');
    expect(api.requests('POST /auth/login')).toHaveLength(1);
  });
});
