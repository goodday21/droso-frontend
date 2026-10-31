import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiResult, toApiFailure } from '../api/api-error';
import { Credentials, CurrentUser, LoginResponse, UserResponse } from './auth.model';

export const REGISTER_ENDPOINT = '/api/v1/auth/register';
export const LOGIN_ENDPOINT = '/api/v1/auth/login';
export const ME_ENDPOINT = '/api/v1/auth/me';
export const REFRESH_ENDPOINT = '/api/v1/auth/refresh';
export const LOGOUT_ENDPOINT = '/api/v1/auth/logout';

/**
 * Client of the authentication endpoints.
 *
 * Like the health client, it never errors: every answer of the backend, including the expected
 * ones such as 409 or 401, is a result that the page decides how to show.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  register(credentials: Credentials): Observable<ApiResult<UserResponse>> {
    return this.post<UserResponse>(REGISTER_ENDPOINT, credentials);
  }

  login(credentials: Credentials): Observable<ApiResult<LoginResponse>> {
    return this.post<LoginResponse>(LOGIN_ENDPOINT, credentials);
  }

  /**
   * A new access token for the refresh cookie, which the backend replaces with a new one.
   *
   * There is no body and no token: the browser sends the cookie (`HttpOnly`, never seen by the
   * application) and `Origin` itself. Call it through `RefreshTokenService` only: the same cookie
   * sent twice ends the login.
   */
  refresh(): Observable<ApiResult<LoginResponse>> {
    return toResult(this.http.post<LoginResponse>(REFRESH_ENDPOINT, null));
  }

  /** Revokes the refresh cookie of this login; the backend answers 204 even without one. */
  logout(): Observable<ApiResult<null>> {
    return toResult(this.http.post<null>(LOGOUT_ENDPOINT, null));
  }

  /** The signed-in user; the token is added by `authInterceptor`. */
  me(): Observable<ApiResult<CurrentUser>> {
    return toResult(this.http.get<CurrentUser>(ME_ENDPOINT));
  }

  private post<T>(url: string, credentials: Credentials): Observable<ApiResult<T>> {
    // Only the two properties: the backend rejects any unknown one with 400.
    const body: Credentials = { email: credentials.email, password: credentials.password };
    return toResult(this.http.post<T>(url, body));
  }
}

function toResult<T>(call: Observable<T>): Observable<ApiResult<T>> {
  return call.pipe(
    map((response): ApiResult<T> => ({ ok: true, body: response })),
    catchError((error: HttpErrorResponse) => of<ApiResult<T>>({ ok: false, failure: toApiFailure(error) })),
  );
}
