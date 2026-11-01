import { MockAnswer } from '../api-mock';

/** Answers of the management of the users, as described by the API contract of the backend. */

export interface MockUser {
  id: number;
  email: string;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  createdAt: string;
}

/** `count` users with the ids from 1, the first one the administrator: `user2@example.com`… */
export function users(count: number): MockUser[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    email: index === 0 ? 'admin@example.com' : `user${index + 1}@example.com`,
    role: index === 0 ? 'ADMIN' : 'USER',
    createdAt: '2026-10-30T09:00:00.123456Z',
  }));
}

/**
 * HTTP 200 of `GET /users`, the page that the query asks of the list, as the backend sorts and cuts
 * it: `sort` `id`, `email` or `role` (default `id`), `direction` `asc` or `desc` (default `desc`),
 * users with an equal value by id in the same direction; `page` from 0 (default 0), `size` (default
 * 20); a page past the end has no items. Emails and roles compare byte by byte, as the collation `C`
 * of the backend.
 */
export function usersPage(all: MockUser[]): MockAnswer {
  return (query) => {
    const page = Number(query.get('page') ?? 0);
    const size = Number(query.get('size') ?? 20);
    const sort = (query.get('sort') ?? 'id') as 'id' | 'email' | 'role';
    const sign = query.get('direction') === 'asc' ? 1 : -1;
    const compare = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);
    const sorted = [...all].sort((a, b) => sign * (compare(a[sort], b[sort]) || compare(a.id, b.id)));
    return {
      status: 200,
      json: {
        items: sorted.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: all.length,
        totalPages: Math.ceil(all.length / size),
      },
    };
  };
}
