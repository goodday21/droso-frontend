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
 * HTTP 200 of `GET /users`, the page that the query asks of the list, as the backend cuts it:
 * `page` from 0 (default 0), `size` (default 20); a page past the end has no items.
 */
export function usersPage(all: MockUser[]): MockAnswer {
  return (query) => {
    const page = Number(query.get('page') ?? 0);
    const size = Number(query.get('size') ?? 20);
    return {
      status: 200,
      json: {
        items: all.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: all.length,
        totalPages: Math.ceil(all.length / size),
      },
    };
  };
}
