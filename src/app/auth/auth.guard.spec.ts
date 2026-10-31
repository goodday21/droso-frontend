import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthSessionService } from './auth-session.service';
import { CurrentUserService, CurrentUserState } from './current-user.service';
import { RefreshOutcome, RefreshTokenService } from './refresh-token.service';

describe('authGuard', () => {
  const key = 'droso.session';
  let session: AuthSessionService;
  let refresh: jasmine.Spy<(staleToken: string | null) => Promise<RefreshOutcome>>;
  let revalidate: jasmine.Spy<() => Promise<CurrentUserState>>;

  beforeEach(() => {
    localStorage.removeItem(key);
    refresh = jasmine.createSpy('refresh');
    // A 401 of `/me` ends the session through the interceptor; the stub does it itself.
    revalidate = jasmine.createSpy('revalidate').and.resolveTo({ status: 'loaded' } as CurrentUserState);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RefreshTokenService, useValue: { refresh } },
        { provide: CurrentUserService, useValue: { revalidate } },
      ],
    });
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => localStorage.removeItem(key));

  function check(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<boolean | UrlTree>,
    );
  }

  function signInPage(url = '/login'): UrlTree {
    return TestBed.inject(Router).parseUrl(url);
  }

  it('lets a signed-in user in once the backend has confirmed the session', async () => {
    session.save('eyJ.x.y', 900);

    expect(await check()).toBeTrue();
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sends the user to the sign-in, with a notice, when the backend has ended the session', async () => {
    session.save('eyJ.x.y', 900);
    revalidate.and.callFake(async () => {
      session.clear();
      return { status: 'failed' };
    });

    expect(await check()).toEqual(signInPage('/login?expired=1'));
  });

  it('lets the user in when the check gets no answer', async () => {
    session.save('eyJ.x.y', 900);
    revalidate.and.resolveTo({ status: 'failed' });

    expect(await check()).toBeTrue();
  });

  it('sends a guest to the sign-in without asking the backend', async () => {
    expect(await check()).toEqual(signInPage());
    expect(refresh).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('lets a user with an expired token in once the refresh succeeds', async () => {
    localStorage.setItem(key, JSON.stringify({ accessToken: 'old', expiresAt: Date.now() - 1000 }));
    session.reload();
    refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });

    expect(await check()).toBeTrue();
    expect(refresh).toHaveBeenCalledOnceWith('old');
    expect(revalidate).withContext('the refresh has asked the backend').not.toHaveBeenCalled();
  });

  for (const kind of ['ended', 'failed'] as const) {
    it(`sends a user with an expired token to the sign-in when the refresh has ${kind}`, async () => {
      localStorage.setItem(key, JSON.stringify({ accessToken: 'old', expiresAt: Date.now() - 1000 }));
      session.reload();
      refresh.and.resolveTo({ kind });

      expect(await check()).toEqual(signInPage());
    });
  }
});
