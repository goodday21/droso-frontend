import { USER_MANAGE } from '../users/users.model';

/** A page that the header opens with a tab. */
export interface HeaderTab {
  label: string;
  /** The path of the route, e.g. `/user-profile`; its pages below it keep the tab active. */
  path: string;
  /** The permission of `GET /api/v1/auth/me` that the tab needs; without one, any signed-in user. */
  permission?: string;
}

/**
 * The tabs of the header, from left to right, shown to a signed-in user only; a tab with a
 * permission waits for `/me` and is shown only when the user has it. A new page gets its tab here,
 * next to its route in `app.routes.ts`.
 */
export const HEADER_TABS: readonly HeaderTab[] = [
  { label: 'Users', path: '/users', permission: USER_MANAGE },
  { label: 'User Profile', path: '/user-profile' },
];
