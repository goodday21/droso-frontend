import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthLockService } from './auth-lock.service';
import { AuthSessionService } from './auth-session.service';
import { RefreshTokenService } from './refresh-token.service';

describe('RefreshTokenService', () => {
  const key = 'droso.session';
  let httpMock: HttpTestingController;
  let session: AuthSessionService;
  let service: RefreshTokenService;
  let locked: number;

  beforeEach(() => {
    localStorage.removeItem(key);
    locked = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // That the tabs wait for each other is the business of `AuthLockService`; here only that
        // every use of the cookie goes through it.
        {
          provide: AuthLockService,
          useValue: { run: <T>(task: () => Promise<T>) => (locked++, task()) },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
    service = TestBed.inject(RefreshTokenService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(key);
  });

  /** Lets the promises of the service run up to the next call of the backend. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  async function expectRefresh(): Promise<TestRequest> {
    await settle();
    return httpMock.expectOne('/api/v1/auth/refresh');
  }

  function error(status: number, code: string) {
    return [{ status, code, message: code, fieldErrors: {} }, { status, statusText: code }] as const;
  }

  /** Another tab writes to the storage; its `storage` event has not come yet. */
  function anotherTabSaves(accessToken: string, expiresAt = Date.now() + 900_000): void {
    localStorage.setItem(key, JSON.stringify({ accessToken, expiresAt }));
  }

  it('keeps the new token of a refresh, under the lock', async () => {
    session.save('old', 900);
    const outcome = service.refresh('old');

    (await expectRefresh()).flush({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 });

    expect(await outcome).toEqual({ kind: 'refreshed', accessToken: 'new' });
    expect(session.accessToken()).toBe('new');
    expect(locked).toBe(1);
  });

  it('shares one refresh among the calls that need it at once', async () => {
    session.save('old', 900);
    const first = service.refresh('old');
    const second = service.refresh('old');

    (await expectRefresh()).flush({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 });

    expect(await first).toEqual({ kind: 'refreshed', accessToken: 'new' });
    expect(await second).toEqual({ kind: 'refreshed', accessToken: 'new' });
  });

  it('takes the token that another tab got meanwhile, without sending the cookie', async () => {
    session.save('old', 900);
    anotherTabSaves('new');

    expect(await service.refresh('old')).toEqual({ kind: 'refreshed', accessToken: 'new' });
    httpMock.expectNone('/api/v1/auth/refresh');
  });

  it('refreshes at the start without a session', async () => {
    const outcome = service.refresh(null);

    (await expectRefresh()).flush({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 });

    expect(await outcome).toEqual({ kind: 'refreshed', accessToken: 'new' });
  });

  it('does not refresh a session that another tab has ended', async () => {
    session.save('old', 900);
    localStorage.removeItem(key);

    expect(await service.refresh('old')).toEqual({ kind: 'ended' });
    httpMock.expectNone('/api/v1/auth/refresh');
  });

  for (const [status, code] of [
    [401, 'INVALID_REFRESH_TOKEN'],
    [403, 'FORBIDDEN'],
  ] as const) {
    it(`ends the session when the backend refuses the cookie with ${status} ${code}`, async () => {
      session.save('old', 900);
      const outcome = service.refresh('old');

      (await expectRefresh()).flush(...error(status, code));

      expect(await outcome).toEqual({ kind: 'ended' });
      expect(session.stored()).toBeNull();
    });
  }

  it('keeps the session when the refresh gets no answer of the backend', async () => {
    session.save('old', 900);
    const outcome = service.refresh('old');

    (await expectRefresh()).flush('<html>', { status: 502, statusText: 'Bad Gateway' });

    expect(await outcome).toEqual({ kind: 'failed' });
    expect(session.stored()?.accessToken).toBe('old');
  });

  it('does not bring back a session signed out while the refresh was pending', async () => {
    session.save('old', 900);
    const outcome = service.refresh('old');
    const request = await expectRefresh();

    session.clear();
    request.flush({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 });

    expect(await outcome).toEqual({ kind: 'ended' });
    expect(session.stored()).toBeNull();
  });

  it('does not end a sign-in made in another tab while the refresh was pending', async () => {
    const outcome = service.refresh(null);
    const request = await expectRefresh();

    anotherTabSaves('signed-in');
    request.flush(...error(401, 'INVALID_REFRESH_TOKEN'));

    expect(await outcome).toEqual({ kind: 'refreshed', accessToken: 'signed-in' });
    expect(session.accessToken()).toBe('signed-in');
  });

  it('forgets the session at once on a sign-out, then revokes the cookie under the lock', async () => {
    session.save('old', 900);
    const done = service.logout();

    expect(session.stored()).withContext('before the backend answers').toBeNull();
    const request = httpMock.expectOne('/api/v1/auth/logout');
    expect(request.request.method).toBe('POST');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await done;
    expect(locked).toBe(1);
  });

  it('ends the session when the backend rejects the token it has just given', async () => {
    session.save('old', 900);
    const first = service.refresh('old');
    (await expectRefresh()).flush({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 });
    await first;

    expect(await service.refresh('new')).toEqual({ kind: 'ended' });
    httpMock.expectNone('/api/v1/auth/refresh');
    expect(session.stored()).toBeNull();
  });

  it('refreshes its own token again once it is no longer fresh', async () => {
    const now = Date.now();
    session.save('old', 900);
    const first = service.refresh('old');
    (await expectRefresh()).flush({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 });
    await first;
    spyOn(Date, 'now').and.returnValue(now + 901 * 1000);

    const second = service.refresh('new');

    (await expectRefresh()).flush({ accessToken: 'newer', tokenType: 'Bearer', expiresIn: 900 });
    expect(await second).toEqual({ kind: 'refreshed', accessToken: 'newer' });
  });
});
