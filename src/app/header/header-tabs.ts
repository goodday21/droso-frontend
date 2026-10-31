/** A page that the header opens with a tab. */
export interface HeaderTab {
  label: string;
  /** The path of the route, e.g. `/user-profile`; its pages below it keep the tab active. */
  path: string;
}

/**
 * The tabs of the header, from left to right, shown to a signed-in user only. A new page gets its
 * tab here, next to its route in `app.routes.ts`.
 */
export const HEADER_TABS: readonly HeaderTab[] = [{ label: 'User Profile', path: '/user-profile' }];
