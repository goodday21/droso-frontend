import { convertToParamMap } from '@angular/router';
import { UsersSortKey, nextSort, parseUsersQuery } from './users-query';

describe('parseUsersQuery', () => {
  it('gives the first page of 20 rows, the newest first, without a query', () => {
    expect(parseUsersQuery(convertToParamMap({}))).toEqual({ page: 1, size: 20, sort: 'id', direction: 'desc' });
  });

  it('reads the page, counted from 1, and an offered size', () => {
    for (const size of [1, 10, 20, 100]) {
      expect(parseUsersQuery(convertToParamMap({ page: '3', size: String(size) }))).toEqual(
        jasmine.objectContaining({ page: 3, size }),
      );
    }
  });

  it('reads the column and the direction of the order', () => {
    for (const sort of ['id', 'email', 'role']) {
      for (const direction of ['asc', 'desc']) {
        expect(parseUsersQuery(convertToParamMap({ sort, direction }))).toEqual(
          jasmine.objectContaining({ sort, direction }),
        );
      }
    }
  });

  // The backend refuses any other spelling; without a direction it sorts the column from the end.
  for (const sort of ['Email', 'name', '']) {
    it(`gives the default column for sort=${sort}`, () => {
      expect(parseUsersQuery(convertToParamMap({ sort, direction: 'asc' })).sort).toBe('id');
    });
  }

  for (const direction of ['ASC', 'up', '']) {
    it(`gives the default direction for direction=${direction}`, () => {
      expect(parseUsersQuery(convertToParamMap({ sort: 'email', direction })).direction).toBe('desc');
    });
  }

  for (const page of ['0', '-1', '1.5', 'abc', '', '1e400']) {
    it(`gives the first page for page=${page}`, () => {
      expect(parseUsersQuery(convertToParamMap({ page })).page).toBe(1);
    });
  }

  // The backend refuses a size above 100; the list offers only its own sizes.
  for (const size of ['0', '5', '101', '20.5', 'abc', '']) {
    it(`gives the default size for size=${size}`, () => {
      expect(parseUsersQuery(convertToParamMap({ size })).size).toBe(20);
    });
  }
});

describe('nextSort', () => {
  const cases: [string, UsersSortKey, 'asc' | 'desc'][] = [
    ['the id from the newest', 'id', 'desc'],
    ['the email alphabetically', 'email', 'asc'],
    ['the role alphabetically', 'role', 'asc'],
  ];

  for (const [name, column, direction] of cases) {
    it(`sorts another column first by its own direction: ${name}`, () => {
      const current = column === 'id' ? ({ sort: 'email', direction: 'asc' } as const) : ({ sort: 'id', direction: 'desc' } as const);

      expect(nextSort(current, column)).toEqual({ sort: column, direction });
    });
  }

  it('turns the same column the other way round, back and forth', () => {
    expect(nextSort({ sort: 'email', direction: 'asc' }, 'email')).toEqual({ sort: 'email', direction: 'desc' });
    expect(nextSort({ sort: 'email', direction: 'desc' }, 'email')).toEqual({ sort: 'email', direction: 'asc' });
  });
});
