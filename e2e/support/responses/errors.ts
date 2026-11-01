import { MockResponse } from '../api-mock';

/**
 * The errors of the backend, the same body for every endpoint, as described by its API contract
 * (`droso-backend/backend/README.md`).
 */

const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Request validation failed',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_REGISTERED: 'Email is already registered',
  REGISTRATION_DISABLED: 'Registration is disabled',
  INTERNAL_ERROR: 'Internal server error',
  UNAUTHORIZED: 'Unauthorized',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
};

/** An `ApiError`; several errors of one field are joined with `; `, as the backend does. */
export function apiError(status: number, code: string, fieldErrors: Record<string, string> = {}): MockResponse {
  return { status, json: { status, code, message: MESSAGES[code] ?? code, fieldErrors } };
}
