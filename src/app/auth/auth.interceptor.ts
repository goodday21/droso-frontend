import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { toApiFailure } from '../api/api-error';
import { HEALTH_ENDPOINT } from '../health/health-api.service';
import { LOGIN_ENDPOINT, LOGOUT_ENDPOINT, REFRESH_ENDPOINT, REGISTER_ENDPOINT } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Endpoints that take no access token. They must not get one either: the backend rejects an
 * invalid token (expired, revoked, of a deleted user) with 401 even on a public endpoint, so an old
 * token would break the sign-in, and the refresh before it could even check the cookie.
 */
const PUBLIC_ENDPOINTS: ReadonlySet<string> = new Set([
  HEALTH_ENDPOINT,
  REGISTER_ENDPOINT,
  LOGIN_ENDPOINT,
  REFRESH_ENDPOINT,
  LOGOUT_ENDPOINT,
]);

/** Where a session that the backend no longer accepts sends the user. */
export const SESSION_EXPIRED_URL = '/login?expired=1';

/**
 * Adds `Authorization: Bearer <token>` to the calls of the API while a user is signed in, and
 * renews the token when the backend rejects it.
 *
 * On a 401 `UNAUTHORIZED` the call waits for a refresh (one for all the calls that failed at once,
 * see {@link RefreshTokenService}) and is sent once more with the new token. When the backend
 * refuses the refresh, or rejects the new token as well, the session is over: it is cleared and
 * the user is sent to the sign-in. When the refresh gets no answer, the call fails with its 401 and
 * the session is kept.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || PUBLIC_ENDPOINTS.has(request.url)) {
    return next(request);
  }
  const session = inject(AuthSessionService);
  const refresher = inject(RefreshTokenService);
  const router = inject(Router);

  const sentToken = session.stored()?.accessToken ?? null;
  const endSession = () => {
    session.clear();
    void router.navigateByUrl(SESSION_EXPIRED_URL);
  };

  return next(withToken(request, session.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        return throwError(() => error);
      }
      // The end of the session hangs on the promise, not on the subscription: the caller may
      // unsubscribe meanwhile, e.g. `CurrentUserService` as soon as the token changes.
      const refreshed = refresher.refresh(sentToken).then((outcome) => {
        // A guest has no session to end, and is not told that it expired.
        if (outcome.kind === 'ended' && sentToken !== null) {
          endSession();
        }
        return outcome;
      });
      return from(refreshed).pipe(
        switchMap((outcome) => {
          if (outcome.kind !== 'refreshed') {
            return throwError(() => error);
          }
          return next(withToken(request, outcome.accessToken)).pipe(
            catchError((retryError: unknown) => {
              if (isUnauthorized(retryError)) {
                endSession();
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};

function withToken<T>(request: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token === null ? request : request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isUnauthorized(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
    return false;
  }
  const failure = toApiFailure(error);
  return failure.kind === 'api' && failure.error.code === 'UNAUTHORIZED';
}
