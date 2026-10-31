import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { CurrentUserService, CurrentUserState } from './current-user.service';
import { RefreshOutcome, RefreshTokenService } from './refresh-token.service';
import {
  REFRESH_AHEAD_MS,
  REVALIDATE_INTERVAL_MS,
  START_REFRESH_TIMEOUT_MS,
  SessionKeeperService,
} from './session-keeper.service';

describe('SessionKeeperService', () => {
  const key = 'droso.session';
  let session: AuthSessionService;
  let refresh: jasmine.Spy<(staleToken: string | null) => Promise<RefreshOutcome>>;
  let navigateByUrl: jasmine.Spy;
  let revalidate: jasmine.Spy<() => Promise<CurrentUserState>>;

  beforeEach(() => {
    localStorage.removeItem(key);
    refresh = jasmine.createSpy('refresh');
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    revalidate = jasmine.createSpy('revalidate').and.resolveTo({ status: 'none' });
    TestBed.configureTestingModule({
      providers: [
        { provide: RefreshTokenService, useValue: { refresh } },
        // What a check of the session does with a 401 is the business of `CurrentUserService`.
        { provide: CurrentUserService, useValue: { revalidate } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.removeItem(key);
  });

  async function start(): Promise<void> {
    await TestBed.inject(SessionKeeperService).start();
    // Lets the effect behind `toObservable` set the timer of the current token.
    TestBed.tick();
  }

  /** Lets the promise of a refresh settle. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  describe('at the start', () => {
    it('does not refresh a valid token', async () => {
      session.save('eyJ.x.y', 900);

      await start();

      expect(refresh).not.toHaveBeenCalled();
    });

    it('refreshes silently without a session', async () => {
      refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });

      await start();

      expect(refresh).toHaveBeenCalledOnceWith(null);
    });

    it('refreshes an expired token, and leaves the user a guest when that fails', async () => {
      localStorage.setItem(key, JSON.stringify({ accessToken: 'old', expiresAt: Date.now() - 1000 }));
      session.reload();
      refresh.and.resolveTo({ kind: 'ended' });

      await start();

      expect(refresh).toHaveBeenCalledOnceWith('old');
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not wait for a refresh longer than the timeout', async () => {
      jasmine.clock().install();
      refresh.and.returnValue(new Promise(() => {}));
      let started = false;
      const starting = TestBed.inject(SessionKeeperService)
        .start()
        .then(() => (started = true));

      jasmine.clock().tick(START_REFRESH_TIMEOUT_MS - 1);
      await Promise.resolve();
      expect(started).toBeFalse();

      jasmine.clock().tick(1);
      await starting;
      expect(started).toBeTrue();
    });
  });

  describe('while the application is open', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date());
    });

    it('replaces the token a minute before it expires', async () => {
      session.save('old', 900);
      refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });
      await start();

      jasmine.clock().tick(900_000 - REFRESH_AHEAD_MS - 1);
      expect(refresh).not.toHaveBeenCalled();

      jasmine.clock().tick(1);
      expect(refresh).toHaveBeenCalledOnceWith('old');
    });

    it('sets the timer again for the token that a refresh gives', async () => {
      session.save('old', 900);
      refresh.and.callFake(async () => {
        session.save('new', 900);
        return { kind: 'refreshed', accessToken: 'new' };
      });
      await start();

      jasmine.clock().tick(900_000 - REFRESH_AHEAD_MS);
      await Promise.resolve();
      TestBed.tick();
      jasmine.clock().tick(900_000 - REFRESH_AHEAD_MS - 1);
      expect(refresh).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(1);
      expect(refresh.calls.allArgs()).toEqual([['old'], ['new']]);
    });

    it('sends the user to the sign-in when the backend refuses the refresh', async () => {
      session.save('old', 900);
      refresh.and.resolveTo({ kind: 'ended' });
      await start();

      jasmine.clock().tick(900_000 - REFRESH_AHEAD_MS);
      await Promise.resolve();
      await Promise.resolve();

      expect(navigateByUrl).toHaveBeenCalledOnceWith('/login?expired=1');
    });

    it('keeps the user signed in when the refresh gets no answer', async () => {
      session.save('old', 900);
      refresh.and.resolveTo({ kind: 'failed' });
      await start();

      jasmine.clock().tick(900_000 - REFRESH_AHEAD_MS);
      await Promise.resolve();
      await Promise.resolve();

      expect(navigateByUrl).not.toHaveBeenCalled();
    });
  });

  it('refreshes a token that expired while the tab was hidden, once it is visible again', async () => {
    const now = Date.now();
    session.save('old', 900);
    refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });
    await start();
    spyOn(Date, 'now').and.returnValue(now + 901 * 1000);

    spyOnProperty(document, 'visibilityState').and.returnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(refresh).toHaveBeenCalledOnceWith('old');
  });

  describe('when the window gets the focus or the tab becomes visible', () => {
    let visibility: jasmine.Spy;

    beforeEach(() => {
      visibility = spyOnProperty(document, 'visibilityState').and.returnValue('visible');
    });

    it('asks the backend whether a fresh token is still valid, without refreshing it', async () => {
      session.save('old', 900);
      await start();

      document.dispatchEvent(new Event('visibilitychange'));

      expect(revalidate).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
    });

    it('asks on a focus of the window as well', async () => {
      session.save('old', 900);
      await start();

      window.dispatchEvent(new Event('focus'));

      expect(revalidate).toHaveBeenCalledTimes(1);
    });

    it('asks once for the focus and the visibility of one switch, and again later', async () => {
      const now = Date.now();
      session.save('old', 900);
      await start();
      const clock = spyOn(Date, 'now').and.returnValue(now);

      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      expect(revalidate).toHaveBeenCalledTimes(1);

      clock.and.returnValue(now + REVALIDATE_INTERVAL_MS);
      window.dispatchEvent(new Event('focus'));
      expect(revalidate).toHaveBeenCalledTimes(2);
    });

    it('asks nothing for a guest', async () => {
      refresh.and.resolveTo({ kind: 'ended' });
      await start();

      window.dispatchEvent(new Event('focus'));

      expect(revalidate).not.toHaveBeenCalled();
    });

    it('asks nothing when the tab is hidden', async () => {
      session.save('old', 900);
      await start();
      visibility.and.returnValue('hidden');

      document.dispatchEvent(new Event('visibilitychange'));

      expect(revalidate).not.toHaveBeenCalled();
    });
  });

  it('sends the tab to the sign-in when another tab ends the session', async () => {
    session.save('old', 900);
    await start();

    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent('storage', { key }));
    await settle();

    expect(navigateByUrl).toHaveBeenCalledOnceWith('/login');
  });
});
