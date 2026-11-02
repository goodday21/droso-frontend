/** Body of `POST /api/v1/auth/register` and of `POST /api/v1/auth/login`. */
export interface Credentials {
  email: string;
  password: string;
}

export type Role = 'ADMIN' | 'MANAGER' | 'USER';

/** Every role, in the order of the backend: alphabetically by the code. */
export const ROLES: readonly Role[] = ['ADMIN', 'MANAGER', 'USER'];

/** A user as returned by the backend; neither the password nor its hash is ever returned. */
export interface UserResponse {
  id: number;
  email: string;
  role: Role;
  createdAt: string;
}

/**
 * Body of `GET /api/v1/auth/me`: the user as currently stored, so its role may differ from the
 * claim `role` of the token, and the permissions of that role. The permissions are a hint for the
 * interface only; the backend checks them on every request.
 */
export interface CurrentUser extends UserResponse {
  permissions: string[];
}

/**
 * Body of a successful (HTTP 200) login or refresh. The refresh token comes as an `HttpOnly`
 * cookie, never in the body.
 */
export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Lifetime of the access token in seconds (15 minutes). */
  expiresIn: number;
}

/** Limits that the backend applies to the login as well, so the form may check them early. */
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MAX_LENGTH = 64;
