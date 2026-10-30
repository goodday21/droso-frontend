import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { HEALTH_ENDPOINT } from '../health/health-api.service';
import { LOGIN_ENDPOINT, REGISTER_ENDPOINT } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';

/**
 * Endpoints that need no token. They must not get one either: the backend rejects an invalid
 * token (expired, revoked, of a deleted user) with 401 even on a public endpoint, and an old
 * token would then break the sign-in itself.
 */
const PUBLIC_ENDPOINTS: ReadonlySet<string> = new Set([HEALTH_ENDPOINT, REGISTER_ENDPOINT, LOGIN_ENDPOINT]);

/** Adds `Authorization: Bearer <token>` to the calls of the API while a user is signed in. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || PUBLIC_ENDPOINTS.has(request.url)) {
    return next(request);
  }
  const token = inject(AuthSessionService).accessToken();
  if (token === null) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
