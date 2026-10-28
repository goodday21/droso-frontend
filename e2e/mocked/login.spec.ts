import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, apiError, loggedIn, networkFailure, proxyError } from '../support/responses';
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
    expect(api.requests('login')).toEqual([]);
  });

  test('limits the length of both fields and sends nothing', async ({ api }) => {
    await login.fill(`${'a'.repeat(245)}@gmail.com`, `${'Aa1!'.repeat(16)}x`);
    await login.submit.click();

    await expect(login.fieldErrors('email')).toHaveText(['must be at most 254 characters']);
    await expect(login.fieldErrors('password')).toHaveText(['must be at most 64 characters']);
    expect(api.requests('login')).toEqual([]);
  });

  test('keeps the token and opens the root page', async ({ page, api }) => {
    api.respond('login', loggedIn(1800));

    await login.fill(EMAIL, PASSWORD);
    const sentAfter = Date.now();
    await login.submit.click();

    await expect(page).toHaveURL('/');
    await expect(new AppHeader(page).signOut).toBeVisible();
    expect(api.requests('login')).toEqual([{ email: EMAIL, password: PASSWORD }]);

    const session = await readSession(page);
    expect(session?.accessToken).toBe(ACCESS_TOKEN);
    expect(session?.expiresAt).toBeGreaterThanOrEqual(sentAfter + 1800_000);
    expect(session?.expiresAt).toBeLessThanOrEqual(Date.now() + 1800_000);
  });

  test('rejects wrong credentials and clears the password', async ({ page, api }) => {
    api.respond('login', apiError(401, 'INVALID_CREDENTIALS'));

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

  for (const { failure, response } of [
    { failure: 'an internal error', response: apiError(500, 'INTERNAL_ERROR') },
    { failure: 'an answer that is not an API error', response: proxyError },
  ]) {
    test(`shows a general message on ${failure}`, async ({ api }) => {
      api.respond('login', response);

      await login.fill(EMAIL, PASSWORD);
      await login.submit.click();

      await expect(login.alert).toHaveText('Something went wrong. Please try again later.');
      await expect(login.password).toHaveValue(PASSWORD);
    });
  }

  test('tells that the service is not reachable', async ({ api }) => {
    api.respond('login', networkFailure);

    await login.fill(EMAIL, PASSWORD);
    await login.submit.click();

    await expect(login.alert).toHaveText('The service is not reachable. Check your connection and try again.');
  });

  test('sends one request while the first one is pending', async ({ page, api }) => {
    const release = api.hold('login', loggedIn());

    await login.fill(EMAIL, PASSWORD);
    await login.submit.click();
    await expect(login.submit).toHaveText('Signing in…');
    await expect(login.submit).toBeDisabled();

    await login.submitAgain();
    release();

    await expect(page).toHaveURL('/');
    expect(api.requests('login')).toHaveLength(1);
  });

  test('loses the email of a registration on a reload', async ({ page }) => {
    // The email comes in the state of the navigation, never in the URL.
    await page.goto('/login?registered=1');

    await expect(login.registered).toHaveText('Registration complete. Please sign in.');
    await expect(login.email).toHaveValue('');
  });
});
