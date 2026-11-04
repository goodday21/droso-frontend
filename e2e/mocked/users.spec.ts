import { AppHeader } from '../pages/app-header';
import { UsersPage } from '../pages/users-page';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser } from '../support/responses/auth';
import { MockUser, users, usersPage } from '../support/responses/users';
import { seedSession } from '../support/session';

// What the page shows for each answer, the buttons of the pager and the sizes on offer are checked
// by the spec of the page, how an email is cut to a width by that of `FitEmailComponent`; who gets the tab, by `app.component.spec.ts`; that a
// guest is sent to the sign-in, by `app.routes.spec.ts`. Here the navigation, the URL and the
// history of the tab, and the layout of the table in the window. The deletion of a user is checked
// by the spec of the page and against the backend (`integration/users.spec.ts`); Escape and a click
// outside its dialog, which has the options of the one of the profile, by `user-profile.spec.ts`.

test.describe('Users', () => {
  test.beforeEach(async ({ page, api }) => {
    await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() + 900_000 });
    api.respond('GET /auth/me', currentUser('ADMIN'));
    api.respond('GET /users', usersPage(users(45)));
  });

  test('opens from the tab of the header, below the header, and Back leaves the list', { tag: '@E2E-042' }, async ({ page }) => {
    const list = new UsersPage(page);
    const header = new AppHeader(page);
    await page.goto('/');

    await header.usersTab.click();

    await expect(page).toHaveURL('/users');
    await expect(page).toHaveTitle('Users');
    await expect(list.heading).toHaveText('Users');
    await expect(list.rows).toHaveCount(20);
    await expect(header.usersTab).toHaveAttribute('aria-current', 'page');
    const bar = (await page.locator('header').boundingBox())!;
    const back = (await list.back.boundingBox())!;
    expect(back.y, 'Back is below the header').toBeGreaterThanOrEqual(bar.y + bar.height);

    await list.next.click();
    await expect(page).toHaveURL('/users?page=2&size=20&sort=id&direction=desc');

    // The pages of the list replace one another in the history.
    await list.back.click();

    await expect(page).toHaveURL('/');
  });

  // The emails compare byte by byte, as on the backend: `user19@` < `user2@`, the digits before `@`.
  test('keeps the page, its size and the order in the URL across a reload', { tag: '@E2E-043' }, async ({ page }) => {
    const list = new UsersPage(page);
    await list.open();
    await expect(list.rows).toHaveCount(20);
    await expect(list.rows.first()).toContainText('user45@example.com');

    await list.selectSize(10);
    await expect(page).toHaveURL('/users?page=1&size=10&sort=id&direction=desc');
    await list.sortBy('Email');
    await expect(page).toHaveURL('/users?page=1&size=10&sort=email&direction=asc');
    await expect(list.rows.first()).toContainText('admin@example.com');
    await list.next.click();
    await expect(page).toHaveURL('/users?page=2&size=10&sort=email&direction=asc');
    await expect(list.rows.first()).toContainText('user19@example.com');

    await page.reload();

    await expect(list.pages).toHaveText('Pages 5');
    await expect(list.shown).toHaveText('Lines per page 11–20 of 45');
    await expect(list.columnHead('Email')).toHaveAttribute('aria-sort', 'ascending');
    await expect(list.rows.first()).toContainText('user19@example.com');
  });

  test('Back opens the root when the list was opened directly, even after paging', { tag: '@E2E-044' }, async ({ page }) => {
    const list = new UsersPage(page);
    await list.open('?size=10');
    await list.next.click();
    await expect(page).toHaveURL('/users?page=2&size=10&sort=id&direction=desc');

    await list.back.click();

    await expect(page).toHaveURL('/');
  });

  test('grows with its rows up to the bottom of the window, then scrolls under a fixed head', { tag: '@E2E-045' }, async ({ page }) => {
    const list = new UsersPage(page);
    await list.open('?size=1');
    await expect(list.rows).toHaveCount(1);
    const one = (await list.scroll.boundingBox())!;

    await list.selectSize(10);
    await expect(list.rows).toHaveCount(10);
    const ten = (await list.scroll.boundingBox())!;
    expect(ten.height, 'ten rows are higher than one').toBeGreaterThan(one.height * 3);
    expect(await list.scroll.evaluate((box) => box.scrollHeight > box.clientHeight), 'ten rows fit').toBe(false);

    await list.selectSize(100);
    await expect(list.rows).toHaveCount(45);
    const all = (await list.scroll.boundingBox())!;
    const pager = (await list.pager.boundingBox())!;
    const window = page.viewportSize()!;
    expect(all.height, 'the table grows past ten rows').toBeGreaterThan(ten.height);
    expect(await list.scroll.evaluate((box) => box.scrollHeight > box.clientHeight), 'the rows scroll').toBe(true);
    expect(pager.y, 'the pager is below the table').toBeGreaterThanOrEqual(all.y + all.height);
    expect(pager.y + pager.height, 'the pager stays in the window').toBeLessThanOrEqual(window.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight), 'the page itself does not scroll').toBe(
      window.height,
    );

    const head = (await list.head.boundingBox())!;
    await list.scroll.evaluate((box) => box.scrollTo(0, box.scrollHeight));

    await expect(list.rows.last()).toBeInViewport();
    await expect(list.rows.first()).not.toBeInViewport();
    expect(await list.head.boundingBox(), 'the head stays where it was').toEqual(head);
  });

  test('gives the email the rest of the width of the table, and cuts it there', { tag: '@E2E-046' }, async ({ page, api }) => {
    const long = `${'qwe.very.long.name.'.repeat(8)}x@gmail.com`;
    const user: MockUser = { id: 1, email: long, role: 'MANAGER', createdAt: '2026-10-30T09:00:00.123456Z' };
    api.respond('GET /users', usersPage([user]));
    const users = new UsersPage(page);
    await users.open();
    const longBox = users.rowOf(long).locator('app-fit-email');
    await expect(longBox.locator('[aria-hidden="true"]')).toContainText('…@gmail.com');

    // Up to the end of its cell, less than a character short.
    const gap = await longBox.evaluate((box) => {
      const cell = box.parentElement!.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(box.parentElement!).paddingRight);
      return cell.right - padding - box.lastElementChild!.getBoundingClientRect().right;
    });
    expect(gap, 'the space left at the end of the cell').toBeGreaterThanOrEqual(0);
    expect(gap, 'the space left at the end of the cell').toBeLessThan(12);
  });
});
