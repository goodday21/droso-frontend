import { DOCUMENT, DestroyRef, Injectable, Injector, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, switchMap, timer } from 'rxjs';
import { SESSION_EXPIRED_URL } from './auth.interceptor';
import { AuthSessionService } from './auth-session.service';
import { CurrentUserService } from './current-user.service';
import { RefreshTokenService } from './refresh-token.service';

/** How long before its expiry the access token is replaced. */
export const REFRESH_AHEAD_MS = 60_000;

/**
 * The shortest time between two checks of the session on a focus: one switch to the window fires
 * both `focus` and `visibilitychange`, which need one call.
 */
export const REVALIDATE_INTERVAL_MS = 2_000;

/** How long the start of the application waits for the silent refresh at most. */
export const START_REFRESH_TIMEOUT_MS = 5_000;

/**
 * Keeps the session alive while the application is open, so that the user is not signed out after
 * the 15 minutes of the access token while the refresh cookie (7 days) is still valid.
 *
 * - At the start without a valid token, it refreshes silently before the first page is shown: a
 *   user who comes back within a week is signed in without a password. When that fails, the user
 *   stays a guest on the page they opened.
 * - It replaces the token {@link REFRESH_AHEAD_MS} before it expires, and when the tab becomes
 *   visible again with a token that has expired meanwhile (a sleeping computer delays the timer).
 *   When the backend refuses, the session is over and the user is sent to the sign-in.
 * - When another tab ends the session, it sends this tab to the sign-in as well.
 * - When the window gets the focus or the tab becomes visible, it asks the backend whether the
 *   session is still valid (`CurrentUserService.revalidate`): *Logout all sessions* in another
 *   browser ends it on the backend, which tells no other browser. A 401 then ends it here as well.
 */
@Injectable({ providedIn: 'root' })
export class SessionKeeperService {
  private readonly session = inject(AuthSessionService);
  private readonly refresher = inject(RefreshTokenService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly expiresAt = computed(() => this.session.stored()?.expiresAt ?? null);
  private lastRevalidation = 0;

  /** Called once, by the initializer of the application. */
  async start(): Promise<void> {
    this.session.endedElsewhere
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.router.navigateByUrl('/login'));

    if (!this.session.isAuthenticated()) {
      const staleToken = this.session.stored()?.accessToken ?? null;
      await Promise.race([
        this.refresher.refresh(staleToken),
        new Promise<void>((resolve) => setTimeout(resolve, START_REFRESH_TIMEOUT_MS)),
      ]);
    }

    // Only after the silent refresh: an expired token would set the timer off at once, and its
    // failure would send to the sign-in a user who just stays a guest.
    toObservable(this.expiresAt, { injector: this.injector })
      .pipe(
        switchMap((expiresAt) =>
          expiresAt === null ? EMPTY : timer(Math.max(0, expiresAt - REFRESH_AHEAD_MS - Date.now())),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => void this.renew());

    const onSeen = () => {
      if (this.document.visibilityState !== 'visible') {
        return;
      }
      const expiresAt = this.expiresAt();
      if (expiresAt !== null && expiresAt - REFRESH_AHEAD_MS <= Date.now()) {
        // A refresh asks the backend as well.
        void this.renew();
      } else if (this.session.isAuthenticated() && Date.now() - this.lastRevalidation >= REVALIDATE_INTERVAL_MS) {
        this.lastRevalidation = Date.now();
        void this.currentUser.revalidate();
      }
    };
    const view = this.document.defaultView;
    this.document.addEventListener('visibilitychange', onSeen);
    view?.addEventListener('focus', onSeen);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onSeen);
      view?.removeEventListener('focus', onSeen);
    });
  }

  /** A refresh of the session that the user is in; its end sends them to the sign-in. */
  private async renew(): Promise<void> {
    const staleToken = this.session.stored()?.accessToken ?? null;
    if (staleToken === null) {
      return;
    }
    const outcome = await this.refresher.refresh(staleToken);
    if (outcome.kind === 'ended') {
      void this.router.navigateByUrl(SESSION_EXPIRED_URL);
    }
  }
}
