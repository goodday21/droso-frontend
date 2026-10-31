import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SESSION_EXPIRED_URL } from './auth.interceptor';
import { AuthSessionService } from './auth-session.service';
import { CurrentUserService } from './current-user.service';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Lets only a signed-in user in, with any role; anyone else is sent to the sign-in.
 *
 * A session whose token has just expired is refreshed first: the refresh cookie may still be
 * valid, and the user should not have to sign in again for that; a refresh that succeeds has
 * asked the backend already. A token that has not expired is checked with the backend as well (`GET /me`): *Logout all sessions* in another browser ends it there without
 * this browser being told. A check that gets no answer lets the user in; the page shows the error.
 */
export const authGuard: CanActivateFn = async () => {
  const session = inject(AuthSessionService);
  const refresher = inject(RefreshTokenService);
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    const staleToken = session.stored()?.accessToken ?? null;
    // A refresh that succeeds has asked the backend already.
    if (staleToken !== null && (await refresher.refresh(staleToken)).kind === 'refreshed') {
      return true;
    }
    return router.parseUrl('/login');
  }
  await currentUser.revalidate();
  return session.isAuthenticated() ? true : router.parseUrl(SESSION_EXPIRED_URL);
};
