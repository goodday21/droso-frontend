import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiResult, toApiFailure } from '../api/api-error';
import { UserPage } from './users.model';

export const USERS_ENDPOINT = '/api/v1/users';

/**
 * Client of the management of the users; needs the permission `USER_MANAGE`, the token is added by
 * `authInterceptor`. Like the other clients, it never errors: a 403 is a result as well.
 */
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);

  /** A page of the users; `page` counts from 0, `size` is 1..100. */
  list(page: number, size: number): Observable<ApiResult<UserPage>> {
    return this.http.get<UserPage>(USERS_ENDPOINT, { params: { page, size } }).pipe(
      map((body): ApiResult<UserPage> => ({ ok: true, body })),
      catchError((error: HttpErrorResponse) => of<ApiResult<UserPage>>({ ok: false, failure: toApiFailure(error) })),
    );
  }
}
