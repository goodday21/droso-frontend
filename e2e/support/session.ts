import { Page } from '@playwright/test';

/** The key of `AuthSessionService` in `localStorage`. */
export const SESSION_KEY = 'droso.session';

export interface StoredSession {
  accessToken: string;
  expiresAt: number;
}

/** The session kept by the page, or `null` when there is none. */
export async function readSession(page: Page): Promise<StoredSession | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
  return raw === null ? null : (JSON.parse(raw) as StoredSession);
}

/** Puts a session into the storage before the application starts, on every load of the page. */
export async function seedSession(page: Page, session: StoredSession): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [SESSION_KEY, JSON.stringify(session)] as const,
  );
}
