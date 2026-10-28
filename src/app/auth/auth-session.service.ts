import { DestroyRef, Injectable, inject, signal } from '@angular/core';

const STORAGE_KEY = 'droso.session';

interface StoredSession {
  accessToken: string;
  /** Epoch milliseconds after which the token is no longer accepted. */
  expiresAt: number;
}

/**
 * Holds the access token of the signed-in user.
 *
 * The token is kept in `localStorage`, so that every tab of the application shares one session
 * and a tab opened later is signed in as well. It is not cleared when the browser closes (no page
 * can tell that reliably); what limits it is its lifetime, `expiresIn` of the login.
 *
 * A sign-in or a sign-out in one tab reaches the others through the `storage` event. The storage
 * may be unavailable (private mode, blocked site data), so every access is guarded and the session
 * then lives in memory only.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly session = signal<StoredSession | null>(readStored());

  constructor() {
    // Fired only in the other tabs of the same origin; `key` is null when the storage is cleared.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        this.session.set(readStored());
      }
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  // Methods rather than `computed`: a computed value would be cached until the session changes,
  // and so would not notice that the token has expired. They read the signal, so a template that
  // calls them is still updated on a sign-in or a sign-out.

  /** The token, or `null` when there is none or it has expired. */
  accessToken(): string | null {
    const current = this.session();
    return current && current.expiresAt > Date.now() ? current.accessToken : null;
  }

  isAuthenticated(): boolean {
    return this.accessToken() !== null;
  }

  save(accessToken: string, expiresInSeconds: number): void {
    const session: StoredSession = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 };
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // The session still works in memory.
    }
  }

  clear(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing was stored.
    }
  }
}

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.accessToken === 'string' && typeof parsed.expiresAt === 'number') {
      return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
    }
  } catch {
    // Unavailable storage or a corrupted value: start without a session.
  }
  return null;
}
