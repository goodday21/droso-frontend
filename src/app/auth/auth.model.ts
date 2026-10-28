/** Body of `POST /api/v1/auth/register` and of `POST /api/v1/auth/login`. */
export interface Credentials {
  email: string;
  password: string;
}

/** A user as returned by the backend; neither the password nor its hash is ever returned. */
export interface UserResponse {
  id: number;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  createdAt: string;
}

/** Body of a successful (HTTP 200) login. */
export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Lifetime of the token in seconds; there is no refresh token, the user logs in again. */
  expiresIn: number;
}

/** Limits that the backend applies to the login as well, so the form may check them early. */
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MAX_LENGTH = 64;
