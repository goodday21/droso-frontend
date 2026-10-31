import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Lets only a signed-in user in, with any role; anyone else is sent to the sign-in.
 *
 * A session whose token has just expired is refreshed first: the refresh cookie may still be
 * valid, and the user should not have to sign in again for that.
 */
export const authGuard: CanActivateFn = async () => {
  const session = inject(AuthSessionService);
  const refresher = inject(RefreshTokenService);
  const router = inject(Router);

  if (session.isAuthenticated()) {
    return true;
  }
  const staleToken = session.stored()?.accessToken ?? null;
  if (staleToken !== null && (await refresher.refresh(staleToken)).kind === 'refreshed') {
    return true;
  }
  return router.parseUrl('/login');
};
