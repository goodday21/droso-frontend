import { Injectable } from '@angular/core';

const LOCK_NAME = 'droso-auth-refresh';

/**
 * Runs the tasks that use the refresh cookie one at a time, across all the tabs of the origin.
 *
 * The backend replaces the cookie on every refresh and ends the whole login when an old one comes
 * again, so two tabs must never send it at once. The Web Locks API serializes them; it exists only
 * in a secure context (`https://` or `localhost`). Without it, e.g. on `http://` by an address of
 * the local network, the tasks run at once and only one tab at a time is safe.
 */
@Injectable({ providedIn: 'root' })
export class AuthLockService {
  run<T>(task: () => Promise<T>): Promise<T> {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    return locks ? locks.request(LOCK_NAME, task) : task();
  }
}
