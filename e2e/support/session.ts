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

/**
 * Puts a session into the storage before the application starts, on every load of the page.
 *
 * Only in the page itself: an init script runs in its frames as well, and the root of Taiga UI adds
 * an empty frame of the same origin (the watcher of the font size). The session written again from
 * there would reach the page as a `storage` event of another tab, after the application has ended
 * it.
 */
export async function seedSession(page: Page, session: StoredSession): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (window === window.top) {
        localStorage.setItem(key, value);
      }
    },
    [SESSION_KEY, JSON.stringify(session)] as const,
  );
}
