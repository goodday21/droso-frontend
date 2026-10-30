import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, of, startWith, switchMap, tap } from 'rxjs';
import { ApiResult } from '../api/api-error';
import { AuthApiService } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { CurrentUser } from './auth.model';

/**
 * The signed-in user, as `GET /api/v1/auth/me` returns it.
 *
 * The role comes from the backend rather than from the claim `role` of the token: the claim is
 * the role at the login, while the backend applies a change of the role at once.
 *
 * The user is fetched once per token: when the application starts with a session, on a sign-in,
 * and when another tab signs in. It is `null` without a session, while the call is pending, and
 * when the call fails. A 401 means the token is no longer accepted (revoked, or the user deleted),
 * so the session is cleared; any other failure leaves the session as it is.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly session = inject(AuthSessionService);
  private readonly api = inject(AuthApiService);

  // Only the changes of the token matter here; its expiry is checked by whoever shows the user.
  private readonly token = computed(() => this.session.accessToken());

  readonly user = toSignal(
    toObservable(this.token).pipe(
      switchMap((token) => (token === null ? of(null) : this.fetch())),
    ),
    { initialValue: null },
  );

  private fetch() {
    return this.api.me().pipe(
      tap((result) => {
        if (isUnauthorized(result)) {
          this.session.clear();
        }
      }),
      map((result): CurrentUser | null => (result.ok ? result.body : null)),
      startWith(null),
    );
  }
}

function isUnauthorized(result: ApiResult<CurrentUser>): boolean {
  return !result.ok && result.failure.kind === 'api' && result.failure.error.code === 'UNAUTHORIZED';
}
