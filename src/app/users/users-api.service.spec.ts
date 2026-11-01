import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiResult } from '../api/api-error';
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

  it('asks GET /api/v1/users for the page and its size', () => {
    const body: UserPage = {
      items: [{ id: 1, email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-10-30T09:00:00.123456Z' }],
      page: 2,
      size: 10,
      totalElements: 21,
      totalPages: 3,
    };
    let result: ApiResult<UserPage> | undefined;
    service.list(2, 10).subscribe((value) => (result = value));

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/v1/users');
    expect(request.request.method).toBe('GET');
    expect(request.request.urlWithParams).toBe('/api/v1/users?page=2&size=10');
    request.flush(body);

    expect(result).toEqual({ ok: true, body });
  });

  it('returns a 403 as a result, not an error', () => {
    const error = { status: 403, code: 'FORBIDDEN', message: 'Access denied', fieldErrors: {} };
    let result: ApiResult<UserPage> | undefined;
    let failed = false;
    service.list(0, 20).subscribe({ next: (value) => (result = value), error: () => (failed = true) });

    httpMock.expectOne('/api/v1/users?page=0&size=20').flush(error, { status: 403, statusText: 'Forbidden' });

    expect(failed).toBeFalse();
    expect(result).toEqual({ ok: false, failure: { kind: 'api', error } });
  });
});
