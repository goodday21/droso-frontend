import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { TuiTablePagination } from '@taiga-ui/addon-table';
import { TuiRoot, provideTaiga } from '@taiga-ui/core';
import { CurrentUser, UserResponse } from '../auth/auth.model';
import { CurrentUserService, CurrentUserState } from '../auth/current-user.service';
import { shortenEmail } from '../header/shorten-email';
import { UserPage } from './users.model';
import { UsersPageComponent } from './users-page.component';

/** The routes in the root of Taiga UI, where its dialog is shown, as in the application. */
@Component({
  standalone: true,
  imports: [TuiRoot, RouterOutlet],
  template: `<tui-root><router-outlet /></tui-root>`,
})
class HostComponent {}

describe('UsersPageComponent', () => {
  // How the email is cut is the business of `FitEmailComponent` in the table and of `shortenEmail`
  // in the dialog, the colour of the role that of `RoleBadgeComponent`, how the query is read that
  // of `parseUsersQuery`, Back that of `PageBarComponent`. Here what the page asks and shows. The
  // menu of the sizes of the pager opens in an overlay: here the page gets the size from the event
  // of the pager, the menu itself is clicked by the browser tests. The dialog is the one of Taiga UI:
  // Escape and a click outside it, which it handles itself, are checked by the browser tests of the
  // profile.
  const state = signal<CurrentUserState>({ status: 'none' });
  let fixture: ComponentFixture<HostComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    state.set({ status: 'none' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'users', component: UsersPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTaiga(),
        {
          provide: CurrentUserService,
          useValue: { state, user: computed(() => (state().status === 'loaded' ? (state() as { user: CurrentUser }).user : null)) },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  function user(id: number, email = `user${id}@example.com`): UserResponse {
    return { id, email, role: id === 1 ? 'ADMIN' : 'USER', createdAt: '2026-10-30T09:00:00.123456Z' };
  }

  function pageOf(items: UserResponse[], page: number, size: number, totalElements: number): UserPage {
    return { items, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
  }

  async function open(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
  }

  /** The call of the list that the page has made, by its query; the default order unless given. */
  function call(page: number, size: number, order = 'sort=id&direction=desc'): TestRequest {
    return httpMock.expectOne(`/api/v1/users?page=${page}&size=${size}&${order}`);
  }

  function answer(page: number, size: number, body: UserPage, order?: string): void {
    call(page, size, order).flush(body);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('app-users-page')!;
  }

  /** The cells of each row but those of the deletion, which have no text. */
  function rows(): string[][] {
    return Array.from(element().querySelectorAll('tr'), (row) =>
      // The email once, as it is read out: the parts on the screen repeat it.
      Array.from(row.querySelectorAll(':scope > :not(.actions)'), (cell) =>
        (cell.querySelector('.whole') ?? cell).textContent!.trim(),
      ),
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
    return fixture.debugElement.query(By.directive(TuiTablePagination)).componentInstance;
  }

  /** The button of the order in the head of a column, by the name of the column. */
  function head(name: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll<HTMLButtonElement>('th button')).find(
      (item) => item.textContent!.trim() === name,
    );
    expect(found).withContext(`the head ${name}`).toBeDefined();
    return found!;
  }

  /** `aria-sort` of each head of the table that sorts: only the column sorted by has one. */
  function sorted(): [string, string | null][] {
    return Array.from(element().querySelectorAll('th:not(.actions)'), (th) => [
      th.textContent!.trim(),
      th.getAttribute('aria-sort'),
    ]);
  }

  function text(selector: string): string {
    return element().querySelector(selector)!.textContent!.trim();
  }

  async function click(target: HTMLElement): Promise<void> {
    target.click();
    await fixture.whenStable();
    fixture.detectChanges();
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

  it('asks the newest first by default, and marks the column of the order', async () => {
    await open('/users');
    answer(0, 20, pageOf([user(2), user(1)], 0, 20, 2));

    expect(sorted()).toEqual([
      ['ID', 'descending'],
      ['Email', null],
      ['Role', null],
    ]);
  });

  it('asks the order of the URL', async () => {
    await open('/users?page=2&size=10&sort=role&direction=asc');
    answer(1, 10, pageOf([user(11)], 1, 10, 21), 'sort=role&direction=asc');

    expect(sorted()[2]).toEqual(['Role', 'ascending']);
  });

  // Which direction a column takes first is the business of `nextSort`.
  it('sorts by the column of a click from the first page, and the other way round on the next one', async () => {
    await open('/users?page=2&size=10');
    answer(1, 10, pageOf([user(11)], 1, 10, 35));

    await click(head('Email'));
    expect(router.url).toBe('/users?page=1&size=10&sort=email&direction=asc');
    answer(0, 10, pageOf([user(1)], 0, 10, 35), 'sort=email&direction=asc');
    expect(sorted()[1]).toEqual(['Email', 'ascending']);
    expect(sorted()[0]).toEqual(['ID', null]);

    await click(head('Email'));
    expect(router.url).toBe('/users?page=1&size=10&sort=email&direction=desc');
    answer(0, 10, pageOf([user(1)], 0, 10, 35), 'sort=email&direction=desc');
    expect(sorted()[1]).toEqual(['Email', 'descending']);

    await click(head('ID'));
    expect(router.url).toBe('/users?page=1&size=10&sort=id&direction=desc');
    answer(0, 10, pageOf([user(1)], 0, 10, 35));
  });

  it('keeps the order on another page and on another size', async () => {
    await open('/users?size=10&sort=email&direction=asc');
    answer(0, 10, pageOf([user(1)], 0, 10, 35), 'sort=email&direction=asc');

    await click(button('Next'));
    expect(router.url).toBe('/users?page=2&size=10&sort=email&direction=asc');
    answer(1, 10, pageOf([user(11)], 1, 10, 35), 'sort=email&direction=asc');

    pager().paginationChange.emit({ page: 0, size: 20 });
    await fixture.whenStable();
    expect(router.url).toBe('/users?page=1&size=20&sort=email&direction=asc');
    answer(0, 20, pageOf([user(1)], 0, 20, 35), 'sort=email&direction=asc');
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
    expect(router.url).toBe('/users?page=2&size=10&sort=id&direction=desc');
    answer(1, 10, pageOf([user(11)], 1, 10, 35));
    expect(summary()[1]).toBe('Lines per page 11–20 of 35');
    expect(button('Previous').disabled).toBeFalse();

    await open('/users?page=4&size=10');
    answer(3, 10, pageOf([user(31)], 3, 10, 35));
    expect(summary()[1]).toBe('Lines per page 31–35 of 35');
    expect(button('Next').disabled).toBeTrue();

    await click(button('Previous'));
    expect(router.url).toBe('/users?page=3&size=10&sort=id&direction=desc');
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
    await fixture.whenStable();

    expect(router.url).toBe('/users?page=1&size=10&sort=id&direction=desc');
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

    await open('/users?page=9');
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
      fixture.detectChanges();

      expect(text('[role="alert"]')).toBe(message);
      expect(element().querySelector('table')).toBeNull();
      expect(element().querySelector('.pager')).toBeNull();
    });
  }

  it('shows the list again once a page loads after a failure', async () => {
    await open('/users');
    call(0, 20).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    await open('/users?page=1&size=10');
    answer(0, 10, pageOf([user(1)], 0, 10, 1));

    expect(element().querySelector('[role="alert"]')).toBeNull();
    expect(rows()[1]).toEqual(['1', 'user1@example.com', 'ADMIN']);
  });

  describe('Delete user', () => {
    const me: CurrentUser = {
      id: 1,
      email: 'user1@example.com',
      role: 'ADMIN',
      permissions: ['USER_MANAGE'],
      createdAt: '2026-10-27T10:15:30Z',
    };
    const order = 'sort=email&direction=asc';

    beforeEach(() => state.set({ status: 'loaded', user: me }));

    function dialog(): HTMLElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
    }

    /** A button of the dialog, by its text. */
    function dialogButton(name: string): HTMLButtonElement {
      const found = Array.from(dialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
        (item) => item.textContent!.trim() === name,
      );
      expect(found).withContext(`the button ${name}`).toBeDefined();
      return found!;
    }

    /** The buttons of the deletion in the rows, by what they read out. */
    function deletes(): string[] {
      return Array.from(element().querySelectorAll('td.delete button'), (item) => item.getAttribute('aria-label')!);
    }

    function deleteButton(email: string): HTMLButtonElement {
      return element().querySelector<HTMLButtonElement>(`td.actions button[aria-label="Delete user ${email}"]`)!;
    }

    /** Lets the dialog play its animation, in or out. */
    async function settle(): Promise<void> {
      for (let wait = 0; wait < 20; wait++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        fixture.detectChanges();
      }
      await fixture.whenStable();
    }

    /** Opens the second page of 10 rows by the email, and asks to delete `user12@example.com`. */
    async function ask(): Promise<void> {
      await open(`/users?page=2&size=10&${order}`);
      answer(1, 10, pageOf([user(11), user(12)], 1, 10, 12), order);
      deleteButton('user12@example.com').click();
      await settle();
    }

    function deleteCall(id = 12): TestRequest {
      const request = httpMock.expectOne(`/api/v1/users/${id}`);
      expect(request.request.method).toBe('DELETE');
      return request;
    }

    it('offers to delete every user but the signed-in one, in a last column without a head', async () => {
      await open('/users');
      answer(0, 20, pageOf([user(3), user(2), user(1)], 0, 20, 3));

      expect(deletes()).toEqual(['Delete user user3@example.com', 'Delete user user2@example.com']);
      expect(element().querySelectorAll('tbody tr')[2].querySelector('td.actions')).not.toBeNull();
      const head = element().querySelector('thead tr')!.lastElementChild!;
      expect(head.classList).toContain('actions');
      expect(head.textContent!.trim()).toBe('');
      expect(head.querySelector('button')).toBeNull();
      expect(head.getAttribute('aria-sort')).toBeNull();
    });

    it('offers to delete nobody until the signed-in user is known', async () => {
      state.set({ status: 'loading' });
      await open('/users');
      answer(0, 20, pageOf([user(2), user(1)], 0, 20, 2));
      expect(deletes()).toEqual([]);

      state.set({ status: 'loaded', user: me });
      fixture.detectChanges();

      expect(deletes()).toEqual(['Delete user user2@example.com']);
    });

    it('asks first in a dialog, the email cut to 20 characters, with the focus on Cancel', async () => {
      const long = 'qwe.very.long.name@gmail.com';
      await open('/users');
      answer(0, 20, pageOf([user(2, long)], 0, 20, 1));

      deleteButton(long).click();
      await settle();

      expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe(`Delete user ${shortenEmail(long)}?`);
      expect(shortenEmail(long)).toBe('qwe.very.…@gmail.com');
      expect(dialog()!.textContent).toContain('Soft deletion. User might be restored later');
      expect(document.activeElement).toBe(dialogButton('Cancel'));
      expect(dialogButton('Yes')).toBeTruthy();
    });

    it('closes without a call on Cancel', async () => {
      await ask();

      dialogButton('Cancel').click();
      await settle();

      expect(dialog()).toBeNull();
      httpMock.expectNone('/api/v1/users/12');
    });

    it('deletes on Yes, then closes and asks the page of the URL again', async () => {
      await ask();

      dialogButton('Yes').click();
      fixture.detectChanges();
      const request = deleteCall();
      expect(dialogButton('Deleting…').disabled).toBeTrue();
      expect(dialogButton('Cancel').disabled).toBeTrue();

      request.flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(dialog()).toBeNull();
      expect(router.url).toBe(`/users?page=2&size=10&${order}`);
      expect(element().querySelector('section')!.getAttribute('aria-busy')).toBe('true');
      answer(1, 10, pageOf([user(11), user(13)], 1, 10, 11), order);
      expect(rows().slice(1).map((row) => row[0])).toEqual(['11', '13']);
    });

    it('closes and asks the page again when the user has been deleted meanwhile', async () => {
      await ask();

      dialogButton('Yes').click();
      deleteCall().flush(
        { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Resource not found', fieldErrors: {} },
        { status: 404, statusText: 'Not Found' },
      );
      await settle();

      expect(dialog()).toBeNull();
      answer(1, 10, pageOf([user(11), user(13)], 1, 10, 11), order);
    });

    const deleteFailures: [string, (request: TestRequest) => void, string][] = [
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
        '409 LAST_ADMIN',
        (request) =>
          request.flush(
            { status: 409, code: 'LAST_ADMIN', message: 'The last administrator cannot be removed', fieldErrors: {} },
            { status: 409, statusText: 'Conflict' },
          ),
        'The last administrator cannot be deleted.',
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

    for (const [name, fail, message] of deleteFailures) {
      it(`stays open with the error of ${name}, and keeps the list`, async () => {
        await ask();

        dialogButton('Yes').click();
        fail(deleteCall());
        await settle();

        expect(dialog()!.querySelector('[role="alert"]')!.textContent!.trim()).toBe(message);
        expect(dialogButton('Yes').disabled).toBeFalse();
        expect(dialogButton('Cancel').disabled).toBeFalse();
        expect(rows().slice(1).map((row) => row[0])).toEqual(['11', '12']);
      });
    }

    it('forgets the error of the last attempt when asked again', async () => {
      await ask();
      dialogButton('Yes').click();
      deleteCall().error(new ProgressEvent('error'), { status: 0 });
      await settle();
      dialogButton('Cancel').click();
      await settle();

      deleteButton('user11@example.com').click();
      await settle();

      expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('Delete user user11@example.com?');
      expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('Update role', () => {
    const me: CurrentUser = {
      id: 1,
      email: 'user1@example.com',
      role: 'ADMIN',
      permissions: ['USER_MANAGE'],
      createdAt: '2026-10-27T10:15:30Z',
    };
    const order = 'sort=role&direction=asc';

    beforeEach(() => state.set({ status: 'loaded', user: me }));

    function dialog(): HTMLElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
    }

    /** A button of the footer of the dialog, by its text. */
    function dialogButton(name: string): HTMLButtonElement {
      const found = Array.from(dialog()!.querySelectorAll<HTMLButtonElement>('footer button')).find(
        (item) => item.textContent!.trim() === name,
      );
      expect(found).withContext(`the button ${name}`).toBeDefined();
      return found!;
    }

    /** The menu of the roles, whose value is the role chosen. */
    function select(): HTMLInputElement {
      return dialog()!.querySelector<HTMLInputElement>('input[tuiSelect]')!;
    }

    /** The roles of the open menu, which Taiga UI shows outside the dialog. */
    function options(): HTMLButtonElement[] {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[tuiOption]'));
    }

    /** The buttons of the change of the role in the rows, by what they read out. */
    function updates(): string[] {
      return Array.from(element().querySelectorAll('td.update button'), (item) => item.getAttribute('aria-label')!);
    }

    function updateButton(email: string): HTMLButtonElement {
      return element().querySelector<HTMLButtonElement>(`td.update button[aria-label="Update role of user ${email}"]`)!;
    }

    /** Lets the dialog and the menu play their animations, in or out. */
    async function settle(): Promise<void> {
      for (let wait = 0; wait < 20; wait++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        fixture.detectChanges();
      }
      await fixture.whenStable();
    }

    async function openMenu(): Promise<void> {
      select().click();
      await settle();
    }

    /** Opens the menu of the roles, unless it is open (a click would close it), and chooses one. */
    async function choose(role: string): Promise<void> {
      if (options().length === 0) {
        await openMenu();
      }
      const option = options().find((item) => item.textContent!.trim() === role);
      expect(option).withContext(`the option ${role}`).toBeDefined();
      option!.click();
      await settle();
    }

    /** Opens the second page of 10 rows by the role, and asks to change the role of `user12@example.com`. */
    async function ask(): Promise<void> {
      await open(`/users?page=2&size=10&${order}`);
      answer(1, 10, pageOf([user(11), user(12)], 1, 10, 12), order);
      updateButton('user12@example.com').click();
      await settle();
    }

    function updateCall(id = 12): TestRequest {
      const request = httpMock.expectOne(`/api/v1/users/${id}/role`);
      expect(request.request.method).toBe('PUT');
      return request;
    }

    it('offers to change the role of every user but the signed-in one, in a column left of the deletion', async () => {
      await open('/users');
      answer(0, 20, pageOf([user(3), user(2), user(1)], 0, 20, 3));

      expect(updates()).toEqual(['Update role of user user3@example.com', 'Update role of user user2@example.com']);
      const cells = Array.from(element().querySelector('tbody tr')!.children);
      expect(cells.slice(-2).map((cell) => cell.className)).toEqual([
        jasmine.stringMatching(/\bupdate\b/),
        jasmine.stringMatching(/\bdelete\b/),
      ]);
      const heads = Array.from(element().querySelectorAll('thead th.actions'));
      expect(heads.map((head) => head.textContent!.trim())).toEqual(['', '']);
    });

    it('offers to change the role of nobody until the signed-in user is known', async () => {
      state.set({ status: 'loading' });
      await open('/users');
      answer(0, 20, pageOf([user(2), user(1)], 0, 20, 2));
      expect(updates()).toEqual([]);

      state.set({ status: 'loaded', user: me });
      fixture.detectChanges();

      expect(updates()).toEqual(['Update role of user user2@example.com']);
    });

    it('asks in a dialog: the email cut to 20 characters, the role of the user chosen, the focus on Cancel', async () => {
      const long = 'qwe.very.long.name@gmail.com';
      await open('/users');
      answer(0, 20, pageOf([user(2, long)], 0, 20, 1));

      updateButton(long).click();
      await settle();

      expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe(`Update role of the user ${shortenEmail(long)}`);
      expect(select().value).toBe('USER');
      expect(document.activeElement).toBe(dialogButton('Cancel'));
      expect(dialogButton('Update').disabled).toBeTrue();
    });

    it('offers the two other roles, and enables Update once one is chosen', async () => {
      await ask();

      await openMenu();
      expect(options().map((item) => item.textContent!.trim())).toEqual(['ADMIN', 'MANAGER']);

      await choose('MANAGER');

      expect(select().value).toBe('MANAGER');
      expect(dialogButton('Update').disabled).toBeFalse();
    });

    it('closes without a call on Cancel', async () => {
      await ask();
      await choose('MANAGER');

      dialogButton('Cancel').click();
      await settle();

      expect(dialog()).toBeNull();
      httpMock.expectNone('/api/v1/users/12/role');
    });

    it('gives the role chosen on Update, then closes and asks the page of the URL again', async () => {
      await ask();
      await choose('MANAGER');

      dialogButton('Update').click();
      fixture.detectChanges();
      const request = updateCall();
      expect(request.request.body).toEqual({ role: 'MANAGER' });
      expect(dialogButton('Updating…').disabled).toBeTrue();
      expect(dialogButton('Cancel').disabled).toBeTrue();

      request.flush({ ...user(12), role: 'MANAGER' });
      await settle();

      expect(dialog()).toBeNull();
      expect(router.url).toBe(`/users?page=2&size=10&${order}`);
      expect(element().querySelector('section')!.getAttribute('aria-busy')).toBe('true');
      answer(1, 10, pageOf([user(11), { ...user(12), role: 'MANAGER' }], 1, 10, 12), order);
      expect(rows()[2]).toEqual(['12', 'user12@example.com', 'MANAGER']);
    });

    const updateFailures: [string, (request: TestRequest) => void, string][] = [
      [
        '404 RESOURCE_NOT_FOUND',
        (request) =>
          request.flush(
            { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Resource not found', fieldErrors: {} },
            { status: 404, statusText: 'Not Found' },
          ),
        'User has already been deleted. Please reload the page',
      ],
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
        '409 LAST_ADMIN',
        (request) =>
          request.flush(
            { status: 409, code: 'LAST_ADMIN', message: 'The last administrator cannot be removed', fieldErrors: {} },
            { status: 409, statusText: 'Conflict' },
          ),
        'The last administrator cannot be demoted.',
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

    for (const [name, fail, message] of updateFailures) {
      it(`stays open with the error of ${name}, the role chosen and the list`, async () => {
        await ask();
        await choose('MANAGER');

        dialogButton('Update').click();
        fail(updateCall());
        await settle();

        expect(dialog()!.querySelector('[role="alert"]')!.textContent!.trim()).toBe(message);
        expect(select().value).toBe('MANAGER');
        expect(dialogButton('Update').disabled).toBeFalse();
        expect(dialogButton('Cancel').disabled).toBeFalse();
        expect(rows().slice(1).map((row) => row[0])).toEqual(['11', '12']);
      });
    }

    it('forgets the error and the role chosen of the last attempt when asked again', async () => {
      await ask();
      await choose('MANAGER');
      dialogButton('Update').click();
      updateCall().error(new ProgressEvent('error'), { status: 0 });
      await settle();
      dialogButton('Cancel').click();
      await settle();

      updateButton('user11@example.com').click();
      await settle();

      expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('Update role of the user user11@example.com');
      expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
      expect(select().value).toBe('USER');
      expect(dialogButton('Update').disabled).toBeTrue();
    });
  });
});
