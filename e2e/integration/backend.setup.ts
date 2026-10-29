import { expect, test as setup } from '@playwright/test';

/**
 * Stops the run at once, with a clear message, when the backend does not answer: otherwise every
 * test would fail on its own with *Something went wrong* from the proxy of the dev server.
 */
setup('the backend answers behind the dev server', async ({ request }) => {
  const response = await request.get('/api/v1/health');

  expect(
    response.status(),
    'The backend on http://localhost:8080 is not running or its database is down: ' +
      'start it with `./gradlew bootRunWithPostgres` in droso-backend/backend',
  ).toBe(200);
});
