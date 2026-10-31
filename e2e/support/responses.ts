import { MockResponse } from './api-mock';

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

/** HTTP 200 of `GET /auth/me`, with the permissions that the backend gives to the role. */
export function currentUser(role: 'USER' | 'MANAGER' | 'ADMIN' = 'USER', email = 'qwe@gmail.com'): MockResponse {
  const permissions = {
    USER: ['DEFECT_READ', 'DEFECT_CREATE'],
    MANAGER: ['DEFECT_READ', 'DEFECT_CREATE', 'DEFECT_UPDATE'],
    ADMIN: ['DEFECT_READ', 'DEFECT_CREATE', 'DEFECT_UPDATE', 'USER_MANAGE'],
  }[role];
  return {
    status: 200,
    json: { id: 1, email, role, permissions, createdAt: '2026-10-28T10:00:00.123456Z' },
  };
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
