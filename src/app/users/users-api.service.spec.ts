import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiResult } from '../api/api-error';
import { UserResponse } from '../auth/auth.model';
import { UserPage } from './users.model';
import { UsersApiService } from './users-api.service';

describe('UsersApiService', () => {
  let service: UsersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('asks GET /api/v1/users for the page, its size and the order', () => {
    const body: UserPage = {
      items: [{ id: 1, email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-10-30T09:00:00.123456Z' }],
      page: 2,
      size: 10,
      totalElements: 21,
      totalPages: 3,
    };
    let result: ApiResult<UserPage> | undefined;
    service.list(2, 10, { sort: 'email', direction: 'asc' }).subscribe((value) => (result = value));

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/v1/users');
    expect(request.request.method).toBe('GET');
    expect(request.request.urlWithParams).toBe('/api/v1/users?page=2&size=10&sort=email&direction=asc');
    request.flush(body);

    expect(result).toEqual({ ok: true, body });
  });

  it('returns a 403 as a result, not an error', () => {
    const error = { status: 403, code: 'FORBIDDEN', message: 'Access denied', fieldErrors: {} };
    let result: ApiResult<UserPage> | undefined;
    let failed = false;
    service.list(0, 20, { sort: 'id', direction: 'desc' }).subscribe({
      next: (value) => (result = value),
      error: () => (failed = true),
    });

    httpMock.expectOne('/api/v1/users?page=0&size=20&sort=id&direction=desc').flush(error, { status: 403, statusText: 'Forbidden' });

    expect(failed).toBeFalse();
    expect(result).toEqual({ ok: false, failure: { kind: 'api', error } });
  });

  it('asks DELETE /api/v1/users/{id}, and reads the 204 without a body', () => {
    let result: ApiResult<null> | undefined;
    service.delete(12).subscribe((value) => (result = value));

    const request = httpMock.expectOne('/api/v1/users/12');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(result).toEqual({ ok: true, body: null });
  });

  it('returns a failed deletion as a result, not an error', () => {
    const error = { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Resource not found', fieldErrors: {} };
    let result: ApiResult<null> | undefined;
    service.delete(12).subscribe((value) => (result = value));

    httpMock.expectOne('/api/v1/users/12').flush(error, { status: 404, statusText: 'Not Found' });

    expect(result).toEqual({ ok: false, failure: { kind: 'api', error } });
  });

  it('asks PUT /api/v1/users/{id}/role with the role, and reads the user', () => {
    const body: UserResponse = { id: 12, email: 'user12@example.com', role: 'MANAGER', createdAt: '2026-10-30T09:00:00Z' };
    let result: ApiResult<UserResponse> | undefined;
    service.updateRole(12, 'MANAGER').subscribe((value) => (result = value));

    const request = httpMock.expectOne('/api/v1/users/12/role');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ role: 'MANAGER' });
    request.flush(body);

    expect(result).toEqual({ ok: true, body });
  });

  it('returns a failed change of the role as a result, not an error', () => {
    const error = { status: 409, code: 'LAST_ADMIN', message: 'The last administrator cannot be removed', fieldErrors: {} };
    let result: ApiResult<UserResponse> | undefined;
    service.updateRole(1, 'USER').subscribe((value) => (result = value));

    httpMock.expectOne('/api/v1/users/1/role').flush(error, { status: 409, statusText: 'Conflict' });

    expect(result).toEqual({ ok: false, failure: { kind: 'api', error } });
  });
});
