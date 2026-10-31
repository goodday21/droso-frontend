import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { SESSION_KEY, readSession } from '../support/session';

// `test` of Playwright itself, not of `support/fixtures`: these tests talk to the real backend.

const PASSWORD = 'Sup3r-Secret!';

/** A new address for every test, so that the tests need no clean database. */
function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Registers a user through the API, so that a test starts from an existing account. */
async function createUser(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post('/api/v1/auth/register', { data: { email, password: PASSWORD } });
  expect(response.status()).toBe(201);
}

test.describe('Sign-up and sign-in against the backend', () => {
  test('registers, then signs in with the stored email and shows it with the role', async ({ page }) => {
    // The backend lowers the email: the sign-in page gets the stored one.
    const email = uniqueEmail();
    const register = new RegisterPage(page);
    await register.open();
    await expect(new AppHeader(page).signOut).not.toBeVisible();
    await register.fill(email.toUpperCase(), PASSWORD);
    await register.submit.click();

    const login = new LoginPage(page);
    await expect(page).toHaveURL('/login?registered=1');
    await expect(login.email).toHaveValue(email);
    await expect(new AppHeader(page).signOut).not.toBeVisible();

    await login.password.fill(PASSWORD);
    await login.submit.click();

    await expect(page).toHaveURL('/');
    await expect(new AppHeader(page).signOut).toBeVisible();
    // A registration always creates a USER; the header reads the role from `GET /auth/me`.
    await expect(new AppHeader(page).role).toHaveText('Role: USER');
    await expect(new AppHeader(page).email).toHaveText(email);
    const session = await readSession(page);
    expect(session?.accessToken).toBeTruthy();
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
  });

  test('lists the rules of the password that the backend reports', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.open();
    await register.fill(uniqueEmail(), 'secret');
    await register.submit.click();

    // The wording belongs to the backend: only one rule is matched, and that there are several.
    const errors = register.fieldErrors('password');
    await expect(errors.filter({ hasText: 'digit' })).toHaveCount(1);
    expect(await errors.count()).toBeGreaterThan(1);
  });

  test('offers to sign in when the email is already registered', async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    const register = new RegisterPage(page);
    await register.open();
    await register.fill(email, PASSWORD);
    await register.submit.click();

    await expect(register.fieldErrors('email')).toHaveText(['is already registered']);
    await expect(register.signInInstead).toBeVisible();
  });

  test('rejects a wrong password', async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    const login = new LoginPage(page);
    await login.open();
    await login.fill(email, 'Wr0ng-Secret!');
    await login.submit.click();

    await expect(login.alert).toHaveText('Invalid email or password.');
    expect(await readSession(page)).toBeNull();
  });
});

test.describe('Refresh token and sign-out against the backend', () => {
  async function signIn(page: Page, request: APIRequestContext): Promise<string> {
    const email = uniqueEmail();
    await createUser(request, email);
    const login = new LoginPage(page);
    await login.open();
    await login.fill(email, PASSWORD);
    await login.submit.click();
    await expect(new AppHeader(page).email).toHaveText(email);
    return email;
  }

  /** A refresh from the page, as the browser sends it: with the cookie and `Origin`. */
  function refreshStatus(page: Page): Promise<number> {
    return page.evaluate(() => fetch('/api/v1/auth/refresh', { method: 'POST' }).then((response) => response.status));
  }

  test('keeps the refresh token in an HttpOnly cookie only', async ({ page, context, request }) => {
    await signIn(page, request);

    const cookie = (await context.cookies()).find((candidate) => candidate.name === 'droso_refresh');
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/api/v1/auth' });
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(storage).not.toContain(cookie!.value);
    expect(await page.evaluate(() => document.cookie)).not.toContain('droso_refresh');
  });

  test('signs in again without a password once the token has expired', async ({ page, request }) => {
    const email = await signIn(page, request);
    const before = (await readSession(page))!;

    // Through the dev server proxy: the backend accepts its `Origin` and the cookie comes along.
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [SESSION_KEY, JSON.stringify({ ...before, expiresAt: Date.now() - 1000 })] as const,
    );
    await page.reload();

    await expect(new AppHeader(page).email).toHaveText(email);
    const after = await readSession(page);
    expect(after?.accessToken).not.toBe(before.accessToken);
    expect(after?.expiresAt).toBeGreaterThan(Date.now());
  });

  test('revokes the refresh token on a sign-out', async ({ page, request }) => {
    await signIn(page, request);

    await new AppHeader(page).signOut.click();

    await expect(page).toHaveURL('/login');
    await expect(new AppHeader(page).signIn).toBeVisible();
    await expect.poll(() => refreshStatus(page)).toBe(401);
  });
});

