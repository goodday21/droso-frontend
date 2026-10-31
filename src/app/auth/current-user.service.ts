import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { CurrentUser } from './auth.model';

/** No session, the call pending, its answer, or a failed call. */
export type CurrentUserState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'loaded'; user: CurrentUser }
  | { status: 'failed' };

/** A call of `/me`: for a new token, shown as pending; or a check of the current one, quiet. */
interface Load {
  token: string | null;
  quiet: boolean;
}

/**
 * The signed-in user, as `GET /api/v1/auth/me` returns it.
 *
 * The role comes from the backend rather than from the claim `role` of the token: the claim is
 * the role at the login, while the backend applies a change of the role at once.
 *
 * The user is fetched for every token: when the application starts with a session, on a sign-in,
 * on a refresh of the token, and when another tab signs in. It is `null` without a session, while
 * the call is pending, and when the call fails. A 401 is handled by `authInterceptor`: it renews
 * the token, or ends the session.
 *
 * {@link revalidate} asks again for the same token: the session may have ended on the backend
 * meanwhile (*Logout all sessions* in another browser), which no other browser is told of.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly session = inject(AuthSessionService);
  private readonly api = inject(AuthApiService);

  // Only the changes of the token matter here; its expiry is checked by whoever shows the user.
  private readonly token = computed(() => this.session.accessToken());

  private readonly loads = new Subject<Load>();
  private readonly results = new Subject<CurrentUserState>();
  private readonly current = signal<CurrentUserState>({ status: 'none' });

  /** Where the call stands, for a page that tells a pending call from a failed one. */
  readonly state = this.current.asReadonly();

  readonly user = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.user : null;
  });

  constructor() {
    // `switchMap`: the answer for a token that has been replaced meanwhile is dropped.
    this.loads
      .pipe(
        switchMap((load) => this.fetch(load).pipe(map((state) => ({ state, quiet: load.quiet })))),
        takeUntilDestroyed(),
      )
      .subscribe(({ state, quiet }) => {
        // A check that gets no answer keeps the user shown: it tells nothing about the session.
        if (!(quiet && state.status === 'failed')) {
          this.current.set(state);
        }
        if (state.status !== 'loading') {
          this.results.next(state);
        }
      });
    toObservable(this.token)
      .pipe(takeUntilDestroyed())
      .subscribe((token) => this.loads.next({ token, quiet: false }));
  }

  /**
   * Asks the backend again whether the session is still valid, without showing the user as
   * pending. A 401 ends the session through `authInterceptor`; the answer is the state it gives.
   */
  revalidate(): Promise<CurrentUserState> {
    const result = firstValueFrom(this.results);
    this.loads.next({ token: this.token(), quiet: true });
    return result;
  }

  private fetch({ token, quiet }: Load): Observable<CurrentUserState> {
    if (token === null) {
      return of<CurrentUserState>({ status: 'none' });
    }
    const call = this.api
      .me()
      .pipe(
        map((result): CurrentUserState => (result.ok ? { status: 'loaded', user: result.body } : { status: 'failed' })),
      );
    return quiet ? call : call.pipe(startWith<CurrentUserState>({ status: 'loading' }));
  }
}
