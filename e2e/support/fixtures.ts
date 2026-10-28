import { expect, test as base } from '@playwright/test';
import { AuthApiMock } from './auth-api';

/**
 * `test` with the API mocked in every test (`auto`), so that no request reaches the dev server
 * proxy, even in a test that does not use `api` itself.
 */
export const test = base.extend<{ api: AuthApiMock }>({
  api: [
    async ({ context }, use) => {
      const api = await AuthApiMock.install(context);
      await use(api);
      expect(api.unexpected, 'calls of the API that the test did not mock').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
