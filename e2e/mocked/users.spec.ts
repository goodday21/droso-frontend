import { AppHeader } from '../pages/app-header';
import { UsersPage } from '../pages/users-page';
import { expect, test } from '../support/fixtures';
import { ACCESS_TOKEN, currentUser } from '../support/responses/auth';
import { users, usersPage } from '../support/responses/users';
import { seedSession } from '../support/session';

// What the page shows for each answer, the buttons of the pager, the sizes on offer and the cut
// emails are checked by the spec of the page; who gets the tab, by `app.component.spec.ts`; that a
// guest is sent to the sign-in, by `app.routes.spec.ts`. Here the navigation, the URL and the
// history of the tab, and the layout of the table in the window.

test.describe('Users', () => {
  test.beforeEach(async ({ page, api }) => {
    await seedSession(page, { accessToken: ACCESS_TOKEN, expiresAt: Date.now() + 900_000 });
    api.respond('GET /auth/me', currentUser('ADMIN'));
    api.respond('GET /users', usersPage(users(45)));
  });

  test('opens from the tab of the header, below the header, and Back leaves the list', async ({ page }) => {
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
    await expect(page).toHaveURL('/users?page=2&size=20');

    // The pages of the list replace one another in the history.
    await list.back.click();

    await expect(page).toHaveURL('/');
  });

  test('keeps the page and its size in the URL across a reload', async ({ page }) => {
    const list = new UsersPage(page);
    await list.open();
    await expect(list.rows).toHaveCount(20);

    await list.size.selectOption('10');
    await expect(page).toHaveURL('/users?page=1&size=10');
    await list.next.click();
    await expect(page).toHaveURL('/users?page=2&size=10');
    await expect(list.rows.first()).toContainText('user11@example.com');

    await page.reload();

    await expect(list.position).toHaveText('Page 2 of 5');
    await expect(list.size).toHaveValue('10');
    await expect(list.rows.first()).toContainText('user11@example.com');
  });

  test('Back opens the root when the list was opened directly, even after paging', async ({ page }) => {
    const list = new UsersPage(page);
    await list.open('?size=10');
    await list.next.click();
    await expect(page).toHaveURL('/users?page=2&size=10');

    await list.back.click();

    await expect(page).toHaveURL('/');
  });

  test('grows with its rows up to the bottom of the window, then scrolls under a fixed head', async ({ page }) => {
    const list = new UsersPage(page);
    await list.open('?size=1');
    await expect(list.rows).toHaveCount(1);
    const one = (await list.scroll.boundingBox())!;

    await list.size.selectOption('10');
    await expect(list.rows).toHaveCount(10);
    const ten = (await list.scroll.boundingBox())!;
    expect(ten.height, 'ten rows are higher than one').toBeGreaterThan(one.height * 3);
    expect(await list.scroll.evaluate((box) => box.scrollHeight > box.clientHeight), 'ten rows fit').toBe(false);

    await list.size.selectOption('100');
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
});
