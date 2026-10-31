import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthSessionService } from './auth-session.service';
import { CurrentUser } from './auth.model';
import { CurrentUserService } from './current-user.service';

describe('CurrentUserService', () => {
  const user: CurrentUser = {
    id: 1,
    email: 'qwe@gmail.com',
    role: 'ADMIN',
    permissions: ['DEFECT_READ', 'DEFECT_CREATE', 'DEFECT_UPDATE', 'USER_MANAGE'],
    createdAt: '2026-10-27T10:15:30.123456Z',
  };

  let httpMock: HttpTestingController;
  let session: AuthSessionService;

  beforeEach(() => {
    localStorage.removeItem('droso.session');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('droso.session');
  });

  /** The service, once the effects that follow the session have run. */
  function start(): CurrentUserService {
    const service = TestBed.inject(CurrentUserService);
    TestBed.tick();
    return service;
  }

  function signIn(token: string): void {
    session.save(token, 1800);
    TestBed.tick();
  }

  it('asks nothing without a session', () => {
    const service = start();

    httpMock.expectNone('/api/v1/auth/me');
    expect(service.user()).toBeNull();
  });

  it('reads the user of a session that exists at the start', () => {
    session.save('eyJ.x.y', 1800);
    const service = start();

    const request = httpMock.expectOne('/api/v1/auth/me');
    expect(service.user()).withContext('while the call is pending').toBeNull();
    request.flush(user);

    expect(service.user()).toEqual(user);
  });

  it('reads the user again for every new token', () => {
    const service = start();
    signIn('first');
    httpMock.expectOne('/api/v1/auth/me').flush(user);

    signIn('second');

    expect(service.user()).withContext('the user of the old token').toBeNull();
    httpMock.expectOne('/api/v1/auth/me').flush({ ...user, role: 'USER' });
    expect(service.user()?.role).toBe('USER');
  });

  it('drops the answer for a token that has been replaced meanwhile', () => {
    const service = start();
    signIn('first');
    const stale = httpMock.expectOne('/api/v1/auth/me');

    signIn('second');

    expect(stale.cancelled).toBeTrue();
    httpMock.expectOne('/api/v1/auth/me').flush({ ...user, role: 'MANAGER' });
    expect(service.user()?.role).toBe('MANAGER');
  });

  it('forgets the user on a sign-out', () => {
    const service = start();
    signIn('eyJ.x.y');
    httpMock.expectOne('/api/v1/auth/me').flush(user);

    session.clear();
    TestBed.tick();

    expect(service.user()).toBeNull();
  });

  // The interceptor has already tried a refresh; the session is its business, not of this service.
  it('has no user but leaves the session alone when the backend rejects the token', () => {
    const service = start();
    signIn('eyJ.x.y');

    httpMock
      .expectOne('/api/v1/auth/me')
      .flush(
        { status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized', fieldErrors: {} },
        { status: 401, statusText: 'Unauthorized' },
      );
    TestBed.tick();

    expect(session.isAuthenticated()).toBeTrue();
    expect(service.user()).toBeNull();
  });

  it('keeps the session but has no user when the backend fails otherwise', () => {
    const service = start();
    signIn('eyJ.x.y');

    httpMock.expectOne('/api/v1/auth/me').flush('<html>', { status: 502, statusText: 'Bad Gateway' });
    TestBed.tick();

    expect(session.isAuthenticated()).toBeTrue();
    expect(service.user()).toBeNull();
  });

  it('tells a pending call from a failed one', () => {
    const service = start();
    expect(service.state()).toEqual({ status: 'none' });

    signIn('eyJ.x.y');
    expect(service.state()).toEqual({ status: 'loading' });

    httpMock.expectOne('/api/v1/auth/me').flush('<html>', { status: 502, statusText: 'Bad Gateway' });
    expect(service.state()).toEqual({ status: 'failed' });
  });

  it('gives the user as the state of an answered call', () => {
    const service = start();
    signIn('eyJ.x.y');

    httpMock.expectOne('/api/v1/auth/me').flush(user);

    expect(service.state()).toEqual({ status: 'loaded', user });
  });
});
