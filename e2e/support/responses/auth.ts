import { MockResponse } from '../api-mock';

/** Answers of the authentication endpoints, as described by the API contract of the backend. */

export const ACCESS_TOKEN = 'e2e-access-token';
/** The token of a refresh; the backend never gives the same one twice. */
export const REFRESHED_TOKEN = 'e2e-refreshed-token';

/** HTTP 201 of the registration. */
export function userCreated(email: string): MockResponse {
  return { status: 201, json: { id: 1, email, role: 'USER', createdAt: '2026-10-28T10:00:00.123456Z' } };
}

/** HTTP 200 of the login. */
export function loggedIn(expiresIn = 900): MockResponse {
  return { status: 200, json: { accessToken: ACCESS_TOKEN, tokenType: 'Bearer', expiresIn } };
}

/** HTTP 200 of the refresh; the new refresh cookie is not mocked, the application never sees it. */
export function refreshed(expiresIn = 900): MockResponse {
  return { status: 200, json: { accessToken: REFRESHED_TOKEN, tokenType: 'Bearer', expiresIn } };
}

/** HTTP 204 of the logout. */
export function loggedOut(): MockResponse {
  return { status: 204 };
}

/** HTTP 200 of `GET /auth/me`, with the permissions that the backend gives to the role. */
export function currentUser(role: 'USER' | 'MANAGER' | 'ADMIN' = 'USER', email = 'qwe@gmail.com'): MockResponse {
  const permissions = {
    USER: ['TICKET_READ', 'TICKET_CREATE'],
    MANAGER: ['TICKET_READ', 'TICKET_CREATE', 'TICKET_UPDATE'],
    ADMIN: ['TICKET_READ', 'TICKET_CREATE', 'TICKET_UPDATE', 'USER_MANAGE'],
  }[role];
  return {
    status: 200,
    json: { id: 1, email, role, permissions, createdAt: '2026-10-28T10:00:00.123456Z' },
  };
}
