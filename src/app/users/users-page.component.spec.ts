import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { UserResponse } from '../auth/auth.model';
import { UserPage } from './users.model';
import { UsersPageComponent } from './users-page.component';

describe('UsersPageComponent', () => {
  // How the email is cut is the business of `shortenEmail`, how the query is read that of
  // `parseUsersQuery`, Back that of `PageBarComponent`. Here what the page asks and shows.
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'users', component: UsersPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
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
      Array.from(row.children, (cell) => cell.textContent!.trim()),
    );
  }

  /** A button of the pager, by its label: `First`, `Previous`, `Next`, `Last`. */
  function button(name: string): HTMLButtonElement {
    const found = element().querySelector<HTMLButtonElement>(`.pager button[aria-label="${name} page"]`) ?? undefined;
    expect(found).withContext(`the button ${name}`).toBeDefined();
    return found!;
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
    expect(text('.position')).toBe('Page 1 of 1');
    expect(text('.total')).toBe('Total: 2');
    expect(element().querySelector('select')!.value).toBe('20');
  });

  it('cuts a long email as the header does, with the full one as its hint', async () => {
    const long = 'qwe.very.long.name@gmail.com';
    await open('/users');
    answer(0, 20, pageOf([user(1, long), user(2)], 0, 20, 2));

    const cells = element().querySelectorAll<HTMLElement>('td.email');
    expect(cells[0].textContent).toBe('qwe.very.…@gmail.com');
    expect(cells[0].title).toBe(long);
    expect(cells[1].hasAttribute('title')).toBeFalse();
  });

  it('asks the page and the size of the URL, the page counted from 1 there and from 0 in the API', async () => {
    await open('/users?page=3&size=10');
    answer(2, 10, pageOf([user(21)], 2, 10, 21));

    expect(text('.position')).toBe('Page 3 of 3');
    expect(element().querySelector('select')!.value).toBe('10');
  });

  it('moves between the pages, and disables the buttons that lead nowhere', async () => {
    await open('/users?size=10');
    answer(0, 10, pageOf([user(1)], 0, 10, 35));
    expect(button('First').disabled).toBeTrue();
    expect(button('Previous').disabled).toBeTrue();
    expect(button('Next').disabled).toBeFalse();
    expect(button('Last').disabled).toBeFalse();

    await click(button('Next'));
    expect(router.url).toBe('/users?page=2&size=10');
    answer(1, 10, pageOf([user(11)], 1, 10, 35));
    expect(text('.position')).toBe('Page 2 of 4');
    expect(button('First').disabled).toBeFalse();
    expect(button('Previous').disabled).toBeFalse();

    await click(button('Last'));
    expect(router.url).toBe('/users?page=4&size=10');
    answer(3, 10, pageOf([user(31)], 3, 10, 35));
    expect(button('Next').disabled).toBeTrue();
    expect(button('Last').disabled).toBeTrue();

    await click(button('Previous'));
    answer(2, 10, pageOf([user(21)], 2, 10, 35));
    await click(button('First'));
    answer(0, 10, pageOf([user(1)], 0, 10, 35));
    expect(text('.position')).toBe('Page 1 of 4');
  });

  it('offers 1, 10, 20 and 100 rows, and starts again from the first page on another size', async () => {
    await open('/users?page=2');
    answer(1, 20, pageOf([user(21)], 1, 20, 21));
    const select = element().querySelector('select')!;
    expect(Array.from(select.options, (option) => option.value)).toEqual(['1', '10', '20', '100']);

    select.value = '100';
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(router.url).toBe('/users?page=1&size=100');
    answer(0, 100, pageOf([user(1), user(21)], 0, 100, 21));
    expect(rows().length).toBe(3);
    expect(select.value).toBe('100');
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
    expect(text('.position')).toBe('Page 1 of 1');
    expect(button('Next').disabled).toBeTrue();

    await harness.navigateByUrl('/users?page=9');
    answer(8, 20, pageOf([], 8, 20, 21));
    expect(rows()[1]).toEqual(['No users on this page.']);
    expect(text('.position')).toBe('Page 9 of 2');
    expect(button('Previous').disabled).toBeFalse();
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
