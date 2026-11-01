import { APIRequestContext, Page, expect } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { LoginPage } from '../pages/login-page';

/** Helpers of the tests against the real backend (`e2e/integration/`). */

export const PASSWORD = 'Sup3r-Secret!';

/**
 * The administrator of the backend, which creates it on start-up from
 * `DROSO_BOOTSTRAP_ADMIN_EMAIL` and `DROSO_BOOTSTRAP_ADMIN_PASSWORD` when there is none. The
 * defaults are the example of the README of the backend; CI sets both (`E2E_ADMIN_*`).
 */
export const ADMIN = {
  email: process.env['E2E_ADMIN_EMAIL'] ?? 'admin@example.com',
  password: process.env['E2E_ADMIN_PASSWORD'] ?? 'Adm1n-Secret!',
};

/** A new address for every test, so that the tests need no clean database. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Registers a user through the API, so that a test starts from an existing account. */
export async function createUser(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post('/api/v1/auth/register', { data: { email, password: PASSWORD } });
  expect(response.status()).toBe(201);
}

/** Signs in with the form, and waits for the header to show the user. */
export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  const login = new LoginPage(page);
  await login.open();
  await login.fill(email, password);
  await login.submit.click();
  await expect(new AppHeader(page).signOut).toBeVisible();
  await expect(new AppHeader(page).role).not.toBeEmpty();
}
