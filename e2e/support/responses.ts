import { MockResponse } from './auth-api';

/** Answers of the backend, as described by its API contract (`droso-backend/backend/README.md`). */

export const ACCESS_TOKEN = 'e2e-access-token';

/** HTTP 201 of the registration. */
export function userCreated(email: string): MockResponse {
  return { status: 201, json: { id: 1, email, role: 'USER', createdAt: '2026-10-28T10:00:00.123456Z' } };
}

/** HTTP 200 of the login. */
export function loggedIn(expiresIn = 1800): MockResponse {
  return { status: 200, json: { accessToken: ACCESS_TOKEN, tokenType: 'Bearer', expiresIn } };
}

const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Request validation failed',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_REGISTERED: 'Email is already registered',
  REGISTRATION_DISABLED: 'Registration is disabled',
  INTERNAL_ERROR: 'Internal server error',
};

/** An `ApiError`; several errors of one field are joined with `; `, as the backend does. */
export function apiError(status: number, code: string, fieldErrors: Record<string, string> = {}): MockResponse {
  return { status, json: { status, code, message: MESSAGES[code] ?? code, fieldErrors } };
}

/** What the dev server proxy answers when the backend is down: an error, but not an `ApiError`. */
export const proxyError: MockResponse = {
  status: 504,
  html: '<html><body><h1>504 Gateway Timeout</h1></body></html>',
};

export const networkFailure: MockResponse = { abort: true };
