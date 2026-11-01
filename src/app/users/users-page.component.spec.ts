import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TuiTablePagination } from '@taiga-ui/addon-table';
import { provideTaiga } from '@taiga-ui/core';
import { UserResponse } from '../auth/auth.model';
import { UserPage } from './users.model';
import { UsersPageComponent } from './users-page.component';

describe('UsersPageComponent', () => {
  // How the email is cut is the business of `FitEmailComponent`, the colour of the role that of
  // `RoleBadgeComponent`, how the query is read that of `parseUsersQuery`, Back that of
  // `PageBarComponent`. Here what the page asks and shows. The menu
  // of the sizes of the pager opens in an overlay: here the page gets the size from the event of the
  // pager, the menu itself is clicked by the browser tests.
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'users', component: UsersPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTaiga(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpMock.verify());

  function user(id: number, email = `user${id}@example.com`): UserResponse {
    return { id, email, role: id === 1 ? 'ADMIN' : 'USER', createdAt: '2026-10-30T09:00:00.123456Z' };
  }

  function pageOf(items: UserResponse[], page: number, size: number, totalElements: number): UserPage {
    return { items, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
  }

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url, UsersPageComponent);
  }

  /** The call of the list that the page has made, by its query. */
  function call(page: number, size: number): TestRequest {
    return httpMock.expectOne(`/api/v1/users?page=${page}&size=${size}`);
  }

  function answer(page: number, size: number, body: UserPage): void {
    call(page, size).flush(body);
    harness.detectChanges();
  }

  function element(): HTMLElement {
    return harness.routeNativeElement!;
  }

  function rows(): string[][] {
    return Array.from(element().querySelectorAll('tr'), (row) =>
      // The email once, as it is read out: the parts on the screen repeat it.
      Array.from(row.children, (cell) => (cell.querySelector('.whole') ?? cell).textContent!.trim()),
    );
  }

  /** A button of the pager, by its text: `Previous`, `Next`. */
  function button(name: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll<HTMLButtonElement>('.pager button')).find(
      (item) => item.textContent!.trim() === name,
    );
    expect(found).withContext(`the button ${name}`).toBeDefined();
    return found!;
  }

  /** The texts of the pager besides its buttons: the number of the pages, the rows shown of all. */
  function summary(): string[] {
    return Array.from(element().querySelectorAll('.pager > span'), (part) =>
      part.textContent!.replace(/\s+/g, ' ').trim(),
    );
  }

  /** The pager of Taiga UI itself, for its sizes and for the change of the size that it emits. */
  function pager(): TuiTablePagination {
    return harness.fixture.debugElement.query(By.directive(TuiTablePagination)).componentInstance;
  }

  function text(selector: string): string {
    return element().querySelector(selector)!.textContent!.trim();
  }

  async function click(target: HTMLElement): Promise<void> {
    target.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('shows its bar with Back and the title', async () => {
    await open('/users');
    answer(0, 20, pageOf([], 0, 20, 0));

    expect(text('app-page-bar h1')).toBe('Users');
  });

  it('asks the first page of 20 rows, and shows the id, the email and the role of each user', async () => {
    await open('/users');
    expect(text('.note')).toBe('Loading…');

    answer(0, 20, pageOf([user(1), user(2)], 0, 20, 2));

    expect(rows()).toEqual([
      ['ID', 'Email', 'Role'],
      ['1', 'user1@example.com', 'ADMIN'],
      ['2', 'user2@example.com', 'USER'],
    ]);
    expect(summary()).toEqual(['Pages 1', 'Lines per page 1–2 of 2']);
    expect(pager().size()).toBe(20);
  });

  // How it is cut to the width is the business of `FitEmailComponent`; the header keeps its 20.
  it('gives the email to a box that fits it to the cell, not cut to 20 characters', async () => {
    const long = 'qwe.very.long.name@gmail.com';
    await open('/users');
    answer(0, 20, pageOf([user(1, long)], 0, 20, 1));

    expect(element().querySelector('td.email app-fit-email .whole')!.textContent).toBe(long);
  });

  it('asks the page and the size of the URL, the page counted from 1 there and from 0 in the API', async () => {
    await open('/users?page=3&size=10');
    answer(2, 10, pageOf([user(21)], 2, 10, 21));

    expect(summary()).toEqual(['Pages 3', 'Lines per page 21–21 of 21']);
    expect(pager().size()).toBe(10);
  });

  it('moves between the pages, and disables the buttons that lead nowhere', async () => {
    await open('/users?size=10');
    answer(0, 10, pageOf([user(1)], 0, 10, 35));
    expect(summary()).toEqual(['Pages 4', 'Lines per page 1–10 of 35']);
    expect(button('Previous').disabled).toBeTrue();
    expect(button('Next').disabled).toBeFalse();

    await click(button('Next'));
    expect(router.url).toBe('/users?page=2&size=10');
    answer(1, 10, pageOf([user(11)], 1, 10, 35));
    expect(summary()[1]).toBe('Lines per page 11–20 of 35');
    expect(button('Previous').disabled).toBeFalse();

    await harness.navigateByUrl('/users?page=4&size=10');
    answer(3, 10, pageOf([user(31)], 3, 10, 35));
    expect(summary()[1]).toBe('Lines per page 31–35 of 35');
    expect(button('Next').disabled).toBeTrue();

    await click(button('Previous'));
    expect(router.url).toBe('/users?page=3&size=10');
    answer(2, 10, pageOf([user(21)], 2, 10, 35));
    expect(summary()[1]).toBe('Lines per page 21–30 of 35');
  });

  it('offers 1, 10, 20 and 100 rows, and starts again from the first page on another size', async () => {
    await open('/users?page=3&size=1');
    answer(2, 1, pageOf([user(3)], 2, 1, 21));
    expect(pager().items()).toEqual([1, 10, 20, 100]);

    // The pager asks the page that keeps the first row shown, the third one of 1 row: the page
    // starts from the first one all the same, the old number means other rows.
    pager().paginationChange.emit({ page: 2, size: 10 });
    await harness.fixture.whenStable();

    expect(router.url).toBe('/users?page=1&size=10');
    answer(0, 10, pageOf([user(1), user(2)], 0, 10, 21));
    expect(rows().length).toBe(3);
    expect(pager().size()).toBe(10);
  });

  it('keeps the rows of the page while the next one loads, and drops the answer of a page left', async () => {
    await open('/users?size=1');
    answer(0, 1, pageOf([user(1)], 0, 1, 3));

    await click(button('Next'));
    const left = call(1, 1);
    expect(rows()[1]).toEqual(['1', 'user1@example.com', 'ADMIN']);
    expect(element().querySelector('section')!.getAttribute('aria-busy')).toBe('true');

    await click(button('Next'));
    expect(left.cancelled).toBeTrue();
    answer(2, 1, pageOf([user(3)], 2, 1, 3));
    expect(rows()[1]).toEqual(['3', 'user3@example.com', 'USER']);
    expect(element().querySelector('section')!.getAttribute('aria-busy')).toBe('false');
  });

  it('tells that there are no users, or none on a page past the end', async () => {
    await open('/users');
    answer(0, 20, pageOf([], 0, 20, 0));
    expect(rows()[1]).toEqual(['No users.']);
    expect(summary()).toEqual(['Pages 0', 'Lines per page 0 - 0 of 0']);
    expect(button('Previous').disabled).toBeTrue();
    expect(button('Next').disabled).toBeTrue();

    await harness.navigateByUrl('/users?page=9');
    answer(8, 20, pageOf([], 8, 20, 21));
    expect(rows()[1]).toEqual(['No users on this page.']);
    expect(button('Previous').disabled).toBeFalse();
    expect(button('Next').disabled).toBeTrue();
  });

  const failures: [string, (request: TestRequest) => void, string][] = [
    [
      '403 FORBIDDEN',
      (request) =>
        request.flush(
          { status: 403, code: 'FORBIDDEN', message: 'Access denied', fieldErrors: {} },
          { status: 403, statusText: 'Forbidden' },
        ),
      'You do not have permission to manage users.',
    ],
    [
      '400 VALIDATION_ERROR',
      (request) =>
        request.flush(
          {
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            fieldErrors: { size: 'must be less than or equal to 100' },
          },
          { status: 400, statusText: 'Bad Request' },
        ),
      'Request validation failed',
    ],
    [
      'a response that is not an ApiError',
      (request) => request.flush('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
      'Something went wrong. Please try again later.',
    ],
    [
      'no response',
      (request) => request.error(new ProgressEvent('error'), { status: 0 }),
      'The service is not reachable. Check your connection and try again.',
    ],
  ];

  for (const [name, fail, message] of failures) {
    it(`shows the error of ${name}, without the table and the pager`, async () => {
      await open('/users');
      fail(call(0, 20));
      harness.detectChanges();

      expect(text('[role="alert"]')).toBe(message);
      expect(element().querySelector('table')).toBeNull();
      expect(element().querySelector('.pager')).toBeNull();
    });
  }

  it('shows the list again once a page loads after a failure', async () => {
    await open('/users');
    call(0, 20).error(new ProgressEvent('error'), { status: 0 });
    harness.detectChanges();

    await harness.navigateByUrl('/users?page=1&size=10');
    answer(0, 10, pageOf([user(1)], 0, 10, 1));

    expect(element().querySelector('[role="alert"]')).toBeNull();
    expect(rows()[1]).toEqual(['1', 'user1@example.com', 'ADMIN']);
  });
});
