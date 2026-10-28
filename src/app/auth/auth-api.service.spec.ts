import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiResult } from '../api/api-error';
import { AuthApiService } from './auth-api.service';
import { LoginResponse, UserResponse } from './auth.model';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  const credentials = { email: 'Qwe.Qwe+1@Gmail.com', password: 'Sup3r-Secret!' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('registers with POST /api/v1/auth/register and the credentials as typed', () => {
    const user: UserResponse = {
      id: 1,
      email: 'qwe.qwe+1@gmail.com',
      role: 'USER',
      createdAt: '2026-10-27T10:15:30.123456Z',
    };
    let result: ApiResult<UserResponse> | undefined;
    service.register(credentials).subscribe((value) => (result = value));

    const request = httpMock.expectOne('/api/v1/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(credentials);
    request.flush(user, { status: 201, statusText: 'Created' });

    expect(result).toEqual({ ok: true, body: user });
  });

  it('sends only the email and the password', () => {
    service.register({ ...credentials, role: 'ADMIN' } as never).subscribe();

    expect(httpMock.expectOne('/api/v1/auth/register').request.body).toEqual(credentials);
  });

  it('returns a 409 of the registration as a result, not an error', () => {
    const body = {
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'The email is already registered',
      fieldErrors: { email: 'is already registered' },
    };
    let result: ApiResult<UserResponse> | undefined;
    let failed = false;
    service.register(credentials).subscribe({ next: (value) => (result = value), error: () => (failed = true) });

    httpMock.expectOne('/api/v1/auth/register').flush(body, { status: 409, statusText: 'Conflict' });

    expect(failed).toBeFalse();
    expect(result).toEqual({ ok: false, failure: { kind: 'api', error: body } });
  });

  it('logs in with POST /api/v1/auth/login', () => {
    const token: LoginResponse = { accessToken: 'eyJ.x.y', tokenType: 'Bearer', expiresIn: 1800 };
    let result: ApiResult<LoginResponse> | undefined;
    service.login(credentials).subscribe((value) => (result = value));

    const request = httpMock.expectOne('/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(credentials);
    request.flush(token);

    expect(result).toEqual({ ok: true, body: token });
  });

  it('returns a network error of the login as "unreachable"', () => {
    let result: ApiResult<LoginResponse> | undefined;
    service.login(credentials).subscribe((value) => (result = value));

    httpMock
      .expectOne('/api/v1/auth/login')
      .error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });

    expect(result).toEqual({ ok: false, failure: { kind: 'unreachable' } });
  });
});
