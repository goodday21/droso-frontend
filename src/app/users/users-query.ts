import { ParamMap } from '@angular/router';

/** The sizes of a page that the list offers. */
export const PAGE_SIZES = [1, 10, 20, 100] as const;

export const DEFAULT_PAGE_SIZE = 20;

/** The columns by which the backend sorts the list (`sort` of `GET /api/v1/users`). */
export const SORT_KEYS = ['id', 'email', 'role'] as const;

export type UsersSortKey = (typeof SORT_KEYS)[number];

export type SortDirection = 'asc' | 'desc';

/** The order of the backend without a query: the newest first. */
export const DEFAULT_SORT: UsersSort = { sort: 'id', direction: 'desc' };

/**
 * The direction of a column on its first click: the id from the newest, as the default order, the
 * email and the role alphabetically.
 */
const FIRST_DIRECTION: Readonly<Record<UsersSortKey, SortDirection>> = { id: 'desc', email: 'asc', role: 'asc' };

/** The order of the list: the column and the direction. */
export interface UsersSort {
  sort: UsersSortKey;
  direction: SortDirection;
}

/** The page of the list in the URL: `page` counts from 1, unlike the API. */
export interface UsersQuery extends UsersSort {
  page: number;
  size: number;
}

/**
 * The page, the size and the order in the query of the URL, e.g.
 * `?page=2&size=100&sort=email&direction=asc`. A missing or invalid value gives the first page, the
 * default size and the default order: a size that the list does not offer included, as the backend
 * would refuse one above 100, and a column or a direction spelled otherwise (`Email`, `ASC`), which
 * the backend would refuse as well.
 */
export function parseUsersQuery(params: ParamMap): UsersQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const sort = params.get('sort');
  const direction = params.get('direction');
  return {
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
    sort: isSortKey(sort) ? sort : DEFAULT_SORT.sort,
    direction: direction === 'asc' || direction === 'desc' ? direction : DEFAULT_SORT.direction,
  };
}

/**
 * The order after a click on the head of a column: the same column the other way round, another one
 * in its first direction.
 */
export function nextSort(current: UsersSort, column: UsersSortKey): UsersSort {
  if (current.sort === column) {
    return { sort: column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { sort: column, direction: FIRST_DIRECTION[column] };
}

function isSortKey(value: string | null): value is UsersSortKey {
  return (SORT_KEYS as readonly (string | null)[]).includes(value);
}
