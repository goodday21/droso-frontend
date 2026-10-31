import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthSessionService } from './auth-session.service';
import { RefreshOutcome, RefreshTokenService } from './refresh-token.service';

describe('authGuard', () => {
  const key = 'droso.session';
  let session: AuthSessionService;
  let refresh: jasmine.Spy<(staleToken: string | null) => Promise<RefreshOutcome>>;

  beforeEach(() => {
    localStorage.removeItem(key);
    refresh = jasmine.createSpy('refresh');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: RefreshTokenService, useValue: { refresh } }],
    });
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => localStorage.removeItem(key));

  function check(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<boolean | UrlTree>,
    );
  }

  function signInPage(): UrlTree {
    return TestBed.inject(Router).parseUrl('/login');
  }

  it('lets a signed-in user in', async () => {
    session.save('eyJ.x.y', 900);

    expect(await check()).toBeTrue();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sends a guest to the sign-in without asking the backend', async () => {
    expect(await check()).toEqual(signInPage());
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lets a user with an expired token in once the refresh succeeds', async () => {
    localStorage.setItem(key, JSON.stringify({ accessToken: 'old', expiresAt: Date.now() - 1000 }));
    session.reload();
    refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });

    expect(await check()).toBeTrue();
    expect(refresh).toHaveBeenCalledOnceWith('old');
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
