import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, of, startWith, switchMap } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { CurrentUser } from './auth.model';

/** No session, the call pending, its answer, or a failed call. */
export type CurrentUserState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'loaded'; user: CurrentUser }
  | { status: 'failed' };

/**
 * The signed-in user, as `GET /api/v1/auth/me` returns it.
 *
 * The role comes from the backend rather than from the claim `role` of the token: the claim is
 * the role at the login, while the backend applies a change of the role at once.
 *
 * The user is fetched once per token: when the application starts with a session, on a sign-in,
 * on a refresh of the token, and when another tab signs in. It is `null` without a session, while
 * the call is pending, and when the call fails. A 401 is handled by `authInterceptor`: it renews
 * the token, or ends the session.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly session = inject(AuthSessionService);
  private readonly api = inject(AuthApiService);

  // Only the changes of the token matter here; its expiry is checked by whoever shows the user.
  private readonly token = computed(() => this.session.accessToken());

  /** Where the call stands, for a page that tells a pending call from a failed one. */
  readonly state = toSignal(
    toObservable(this.token).pipe(
      switchMap((token) => (token === null ? of<CurrentUserState>({ status: 'none' }) : this.fetch())),
    ),
    { initialValue: { status: 'none' } as CurrentUserState },
  );

  readonly user = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.user : null;
  });

  private fetch() {
    return this.api.me().pipe(
      map((result): CurrentUserState => (result.ok ? { status: 'loaded', user: result.body } : { status: 'failed' })),
      startWith<CurrentUserState>({ status: 'loading' }),
    );
  }
}

