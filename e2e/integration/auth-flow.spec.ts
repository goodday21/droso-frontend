import { APIRequestContext, expect, test } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { readSession } from '../support/session';

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
  test('registers, then signs in with the stored email and shows the role', async ({ page }) => {
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
