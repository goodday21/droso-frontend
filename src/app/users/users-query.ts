import { ParamMap } from '@angular/router';

/** The sizes of a page that the list offers. */
export const PAGE_SIZES = [1, 10, 20, 100] as const;

export const DEFAULT_PAGE_SIZE = 20;

/** The page of the list in the URL: `page` counts from 1, unlike the API. */
export interface UsersQuery {
  page: number;
  size: number;
}

/**
 * The page and the size in the query of the URL, e.g. `?page=2&size=100`. A missing or invalid
 * value gives the first page and the default size: a size that the list does not offer included,
 * as the backend would refuse one above 100.
 */
export function parseUsersQuery(params: ParamMap): UsersQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}
