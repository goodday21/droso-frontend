import { UserResponse } from '../auth/auth.model';

/** Body of `GET /api/v1/users`: a page of the active users, sorted by id. */
export interface UserPage {
  items: UserResponse[];
  /** The number of the page, counted from 0. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** The permission that `GET /api/v1/users` needs; only the role `ADMIN` has it. */
export const USER_MANAGE = 'USER_MANAGE';
