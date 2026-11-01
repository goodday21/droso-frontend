import { convertToParamMap } from '@angular/router';
import { parseUsersQuery } from './users-query';

describe('parseUsersQuery', () => {
  it('gives the first page of 20 rows without a query', () => {
    expect(parseUsersQuery(convertToParamMap({}))).toEqual({ page: 1, size: 20 });
  });

  it('reads the page, counted from 1, and an offered size', () => {
    for (const size of [1, 10, 20, 100]) {
      expect(parseUsersQuery(convertToParamMap({ page: '3', size: String(size) }))).toEqual({ page: 3, size });
    }
  });

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
