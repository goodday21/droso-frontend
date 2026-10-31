import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthSessionService } from './auth-session.service';
import { RefreshOutcome, RefreshTokenService } from './refresh-token.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: AuthSessionService;
  let refresh: jasmine.Spy<(staleToken: string | null) => Promise<RefreshOutcome>>;
  let navigateByUrl: jasmine.Spy;

  beforeEach(() => {
    localStorage.removeItem('droso.session');
    // How a refresh is made, shared and locked is the business of `RefreshTokenService`.
    refresh = jasmine.createSpy('refresh');
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RefreshTokenService, useValue: { refresh } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('droso.session');
  });

  function authorizationOf(url: string): string | null {
    http.get(url).subscribe();
    const request = httpMock.expectOne(url);
    request.flush({});
    return request.request.headers.get('Authorization');
  }

  /** Lets the promise of the refresh run up to the next call of the backend. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  function rejectToken(request: TestRequest): void {
    request.flush(
      { status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized', fieldErrors: {} },
      { status: 401, statusText: 'Unauthorized' },
    );
  }

  function call(url = '/api/v1/auth/me') {
    const result: { body?: unknown; error?: HttpErrorResponse } = {};
    http.get(url).subscribe({ next: (body) => (result.body = body), error: (error) => (result.error = error) });
    return result;
  }

  it('sends the token to a protected endpoint', () => {
    session.save('eyJ.x.y', 900);

    expect(authorizationOf('/api/v1/auth/me')).toBe('Bearer eyJ.x.y');
  });

  it('sends no token without a session', () => {
    expect(authorizationOf('/api/v1/auth/me')).toBeNull();
  });

  it('sends no expired token', () => {
    const now = Date.now();
    session.save('eyJ.x.y', 900);
    spyOn(Date, 'now').and.returnValue(now + 901 * 1000);

    expect(authorizationOf('/api/v1/auth/me')).toBeNull();
  });

  for (const url of [
    '/api/v1/health',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/assets/x.json',
  ]) {
    it(`sends no token to ${url}, which takes none`, () => {
      session.save('eyJ.x.y', 900);

      expect(authorizationOf(url)).toBeNull();
    });
  }

  it('refreshes a rejected token and sends the call once more with the new one', async () => {
    session.save('old', 900);
    refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });
    const result = call();

    rejectToken(httpMock.expectOne('/api/v1/auth/me'));
    await settle();
    const retry = httpMock.expectOne('/api/v1/auth/me');
    retry.flush({ id: 1 });

    expect(refresh).toHaveBeenCalledOnceWith('old');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    expect(result.body).toEqual({ id: 1 });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('refreshes an expired token that was not sent', async () => {
    const now = Date.now();
    session.save('old', 900);
    spyOn(Date, 'now').and.returnValue(now + 901 * 1000);
    refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });
    call();

    rejectToken(httpMock.expectOne('/api/v1/auth/me'));
    await settle();
    httpMock.expectOne('/api/v1/auth/me').flush({});

    expect(refresh).toHaveBeenCalledOnceWith('old');
  });

  it('ends the session when the new token is rejected as well, without another refresh', async () => {
    session.save('old', 900);
    refresh.and.resolveTo({ kind: 'refreshed', accessToken: 'new' });
    const result = call();

    rejectToken(httpMock.expectOne('/api/v1/auth/me'));
    await settle();
    rejectToken(httpMock.expectOne('/api/v1/auth/me'));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.error?.status).toBe(401);
    expect(session.stored()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledOnceWith('/login?expired=1');
  });

  it('ends the session when the backend refuses the refresh', async () => {
    session.save('old', 900);
    refresh.and.resolveTo({ kind: 'ended' });
    const result = call();

    rejectToken(httpMock.expectOne('/api/v1/auth/me'));
    await settle();

    expect(result.error?.status).toBe(401);
    expect(session.stored()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledOnceWith('/login?expired=1');
  });

  it('ends the session even when the caller has stopped waiting for the call', async () => {
    session.save('old', 900);
    let finish!: (outcome: RefreshOutcome) => void;
    refresh.and.returnValue(new Promise((resolve) => (finish = resolve)));
    const subscription = http.get('/api/v1/auth/me').subscribe({ error: () => {} });

    rejectToken(httpMock.expectOne('/api/v1/auth/me'));
    subscription.unsubscribe();
    finish({ kind: 'ended' });
    await settle();

    expect(navigateByUrl).toHaveBeenCalledOnceWith('/login?expired=1');
  });

  it('does not send a guest to the sign-in when the refresh is refused', async () => {
    refresh.and.resolveTo({ kind: 'ended' });
    const result = call();

    rejectToken(httpMock.expectOne('/api/v1/auth/me'));
    await settle();

    expect(refresh).toHaveBeenCalledOnceWith(null);
    expect(result.error?.status).toBe(401);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('keeps the session and fails the call when the refresh gets no answer', async () => {
    session.save('old', 900);
    refresh.and.resolveTo({ kind: 'failed' });
    const result = call();

    rejectToken(httpMock.expectOne('/api/v1/auth/me'));
    await settle();

    expect(result.error?.status).toBe(401);
    expect(session.stored()?.accessToken).toBe('old');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not refresh on any other failure', () => {
    session.save('old', 900);
    const result = call();

    httpMock.expectOne('/api/v1/auth/me').flush(
      { status: 403, code: 'FORBIDDEN', message: 'Forbidden', fieldErrors: {} },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(refresh).not.toHaveBeenCalled();
    expect(result.error?.status).toBe(403);
  });

  it('does not refresh on a 401 of an endpoint that takes no token', () => {
    const result = call('/api/v1/auth/refresh');

    httpMock.expectOne('/api/v1/auth/refresh').flush(
      { status: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Invalid', fieldErrors: {} },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(refresh).not.toHaveBeenCalled();
    expect(result.error?.status).toBe(401);
  });
});
