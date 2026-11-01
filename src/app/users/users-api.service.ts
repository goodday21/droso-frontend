import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiResult, toApiFailure } from '../api/api-error';
import { UserPage } from './users.model';
import { UsersSort } from './users-query';

export const USERS_ENDPOINT = '/api/v1/users';

/**
 * Client of the management of the users; needs the permission `USER_MANAGE`, the token is added by
 * `authInterceptor`. Like the other clients, it never errors: a 403 is a result as well.
 */
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);

  /**
   * A page of the users in the order asked; `page` counts from 0, `size` is 1..100. The order is
   * always sent, the default one (`id`, `desc`) included.
   */
  list(page: number, size: number, { sort, direction }: UsersSort): Observable<ApiResult<UserPage>> {
    return this.http.get<UserPage>(USERS_ENDPOINT, { params: { page, size, sort, direction } }).pipe(
      map((body): ApiResult<UserPage> => ({ ok: true, body })),
      catchError((error: HttpErrorResponse) => of<ApiResult<UserPage>>({ ok: false, failure: toApiFailure(error) })),
    );
  }

  /**
   * Soft-deletes the user (`DELETE /api/v1/users/{id}`, 204 without a body): every token of the user
   * is revoked at once. A user deleted already is a 404 `RESOURCE_NOT_FOUND`.
   */
  delete(id: number): Observable<ApiResult<null>> {
    return this.http.delete<void>(`${USERS_ENDPOINT}/${id}`).pipe(
      map((): ApiResult<null> => ({ ok: true, body: null })),
      catchError((error: HttpErrorResponse) => of<ApiResult<null>>({ ok: false, failure: toApiFailure(error) })),
    );
  }
}
