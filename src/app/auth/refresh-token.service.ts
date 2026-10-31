import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiResult } from '../api/api-error';
import { AuthApiService } from './auth-api.service';
import { AuthLockService } from './auth-lock.service';
import { AuthSessionService } from './auth-session.service';
import { LoginResponse } from './auth.model';

/**
 * What a refresh gave:
 *
 * - `refreshed`: a valid access token, new or got by another tab meanwhile;
 * - `ended`:     no session any more: the backend refused the cookie (missing, expired, revoked,
 *                or an origin it does not allow), or another tab signed out meanwhile;
 * - `failed`:    no answer of the backend (network, proxy, 5xx); the session is left as it is.
 */
export type RefreshOutcome = { kind: 'refreshed'; accessToken: string } | { kind: 'ended' } | { kind: 'failed' };

/**
 * A token that this tab got less than this long ago and that the backend already rejects is not
 * refreshed again: the backend refuses the session, and another refresh would only start a loop.
 */
export const FRESH_TOKEN_MS = 30_000;

/** Codes of a refresh that the backend refused for good; asking again cannot help. */
const REFUSED_CODES: ReadonlySet<string> = new Set(['INVALID_REFRESH_TOKEN', 'FORBIDDEN']);

/**
 * Uses the refresh cookie: gets a new access token, or signs out.
 *
 * Every use goes through {@link AuthLockService}, so that no two tabs send one cookie at once; the
 * backend would take the second one for a stolen cookie and end the login everywhere. Within a tab
 * the callers that need a refresh at the same time share one.
 */
@Injectable({ providedIn: 'root' })
export class RefreshTokenService {
  private readonly api = inject(AuthApiService);
  private readonly lock = inject(AuthLockService);
  private readonly session = inject(AuthSessionService);

  private pending: Promise<RefreshOutcome> | null = null;
  private lastIssued: { accessToken: string; at: number } | null = null;

  /**
   * A new access token in place of `staleToken`, the one that the caller saw expire or rejected
   * (`null` when it had none, e.g. at the start without a session).
   *
   * Once this tab holds the lock, the token may have been replaced by another tab already: then
   * that token is the answer and the cookie is not sent again.
   */
  refresh(staleToken: string | null): Promise<RefreshOutcome> {
    this.pending ??= this.lock
      .run(() => this.refreshLocked(staleToken))
      .finally(() => (this.pending = null));
    return this.pending;
  }

  /**
   * Forgets the session at once, then revokes the refresh cookie on the backend.
   *
   * The session goes first, so that the page does not wait for the backend; the call waits for the
   * lock, so that it never races with a refresh of another tab.
   */
  async logout(): Promise<void> {
    this.session.clear();
    await this.lock.run(() => firstValueFrom(this.api.logout()));
  }

  private async refreshLocked(staleToken: string | null): Promise<RefreshOutcome> {
    if (
      staleToken !== null &&
      this.lastIssued?.accessToken === staleToken &&
      Date.now() - this.lastIssued.at < FRESH_TOKEN_MS
    ) {
      if (this.session.reload()?.accessToken === staleToken) {
        this.session.clear();
      }
      return { kind: 'ended' };
    }
    const before = this.session.reload();
    if (before === null && staleToken !== null) {
      return { kind: 'ended' };
    }
    if (before !== null && before.accessToken !== staleToken && before.expiresAt > Date.now()) {
      return { kind: 'refreshed', accessToken: before.accessToken };
    }

    const result = await firstValueFrom(this.api.refresh());

    // A sign-out or a sign-in in another tab while the call was pending wins over its answer.
    const after = this.session.reload();
    if (after?.accessToken !== before?.accessToken) {
      return after !== null && after.expiresAt > Date.now()
        ? { kind: 'refreshed', accessToken: after.accessToken }
        : { kind: 'ended' };
    }
    return this.apply(result);
  }

  private apply(result: ApiResult<LoginResponse>): RefreshOutcome {
    if (result.ok) {
      this.session.save(result.body.accessToken, result.body.expiresIn);
      this.lastIssued = { accessToken: result.body.accessToken, at: Date.now() };
      return { kind: 'refreshed', accessToken: result.body.accessToken };
    }
    const failure = result.failure;
    if (failure.kind === 'api' && REFUSED_CODES.has(failure.error.code)) {
      this.session.clear();
      return { kind: 'ended' };
    }
    return { kind: 'failed' };
  }
}
