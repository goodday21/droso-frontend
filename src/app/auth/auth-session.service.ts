import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

const STORAGE_KEY = 'droso.session';

export interface StoredSession {
  accessToken: string;
  /** Epoch milliseconds after which the token is no longer accepted. */
  expiresAt: number;
}

/**
 * Holds the access token of the signed-in user.
 *
 * The token is kept in `localStorage`, so that every tab of the application shares one session
 * and a tab opened later is signed in as well. It is not cleared when the browser closes (no page
 * can tell that reliably); its lifetime is short (`expiresIn`, 15 minutes), and
 * `RefreshTokenService` replaces it with a new one through the refresh cookie.
 *
 * A sign-in or a sign-out in one tab reaches the others through the `storage` event. The storage
 * may be unavailable (private mode, blocked site data), so every access is guarded and the session
 * then lives in memory only.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly session = signal<StoredSession | null>(readStored() ?? null);

  /** Emits when another tab ends the session: a sign-out, or a refresh that the backend refused. */
  readonly endedElsewhere = new Subject<void>();

  constructor() {
    // Fired only in the other tabs of the same origin; `key` is null when the storage is cleared.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        const before = this.session();
        const after = readStored() ?? null;
        this.session.set(after);
        if (before !== null && after === null) {
          this.endedElsewhere.next();
        }
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

  /** The session as kept, even with an expired token; `null` after a sign-out or without one. */
  stored(): StoredSession | null {
    return this.session();
  }

  /**
   * Reads the session from the storage again and returns it.
   *
   * Another tab may have changed it a moment ago, before its `storage` event reached this tab:
   * whoever is about to use the refresh cookie must see the latest token. Without a storage the
   * session in memory is the only one.
   */
  reload(): StoredSession | null {
    const stored = readStored();
    if (stored === undefined) {
      return this.session();
    }
    const current = this.session();
    if (stored?.accessToken !== current?.accessToken || stored?.expiresAt !== current?.expiresAt) {
      this.session.set(stored);
    }
    return stored;
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

/** The stored session; `null` when there is none or it is corrupted, `undefined` without a storage. */
function readStored(): StoredSession | null | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.accessToken === 'string' && typeof parsed.expiresAt === 'number') {
      return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
    }
  } catch {
    // A corrupted value: no session.
  }
  return null;
}
