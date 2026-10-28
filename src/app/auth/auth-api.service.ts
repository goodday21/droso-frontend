import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiResult, toApiFailure } from '../api/api-error';
import { Credentials, LoginResponse, UserResponse } from './auth.model';

export const REGISTER_ENDPOINT = '/api/v1/auth/register';
export const LOGIN_ENDPOINT = '/api/v1/auth/login';

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

  private post<T>(url: string, credentials: Credentials): Observable<ApiResult<T>> {
    // Only the two properties: the backend rejects any unknown one with 400.
    const body: Credentials = { email: credentials.email, password: credentials.password };
    return this.http.post<T>(url, body).pipe(
      map((response): ApiResult<T> => ({ ok: true, body: response })),
      catchError((error: HttpErrorResponse) => of<ApiResult<T>>({ ok: false, failure: toApiFailure(error) })),
    );
  }
}
