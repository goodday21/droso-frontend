import { expect, test as setup } from '@playwright/test';
import { ADMIN } from '../support/backend';

/**
 * Stops the run at once, with a clear message, when the backend does not answer or has not the
 * administrator of the tests: otherwise every test would fail on its own, with *Something went
 * wrong* from the proxy of the dev server or with a failed sign-in.
 */
setup('the backend answers behind the dev server', async ({ request }) => {
  const response = await request.get('/api/v1/health');

  expect(
    response.status(),
    'The backend on http://localhost:8080 is not running or its database is down: ' +
      'start it with `./gradlew bootRunWithPostgres` in droso-backend/backend',
  ).toBe(200);
});

setup('the administrator of the tests signs in', async ({ request }) => {
  const hint =
    `The backend has no administrator ${ADMIN.email} with the password of the tests: start it once on a ` +
    'database without an administrator with DROSO_BOOTSTRAP_ADMIN_EMAIL and DROSO_BOOTSTRAP_ADMIN_PASSWORD, ' +
    'or set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to the administrator that it has';

  const login = await request.post('/api/v1/auth/login', { data: ADMIN });
  expect(login.status(), hint).toBe(200);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const me = await request.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } });
  expect(((await me.json()) as { permissions: string[] }).permissions, hint).toContain('USER_MANAGE');
});
