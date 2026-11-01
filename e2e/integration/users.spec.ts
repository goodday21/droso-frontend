import { expect, test } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { UsersPage } from '../pages/users-page';
import { ADMIN, createUser, signIn, uniqueEmail } from '../support/backend';

// `test` of Playwright itself, not of `support/fixtures`: these tests talk to the real backend.
// The administrator is checked by `backend.setup.ts`. The order of the list is not checked: the
// backend will let the user choose it.

test.describe('The list of users against the backend', () => {
  test('shows the administrator the list, a page of the size chosen', async ({ page, request }) => {
    // At least two users, so that a page of one row is not the whole list.
    await createUser(request, uniqueEmail());
    await signIn(page, ADMIN.email, ADMIN.password);
    const header = new AppHeader(page);
    const list = new UsersPage(page);

    await header.usersTab.click();

    await expect(page).toHaveURL('/users');
    await list.loaded();
    const total = await list.totalCount();
    expect(total).toBeGreaterThanOrEqual(2);
    await expect(list.rows).toHaveCount(Math.min(total, 20));
    await expect(list.pages).toHaveText(`Pages ${Math.ceil(total / 20)}`);

    await list.selectSize(1);

    // One page per user, as many as the answer counts: the other tests may add users meanwhile.
    await expect(page).toHaveURL('/users?page=1&size=1');
    await list.loaded();
    await expect(list.pages).toHaveText(`Pages ${await list.totalCount()}`);
    await expect(list.rows).toHaveCount(1);
    await list.next.click();
    await expect(page).toHaveURL('/users?page=2&size=1');
    await expect(list.rows).toHaveCount(1);
  });

  test('shows the administrator with the role ADMIN', async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password);
    const list = new UsersPage(page);

    await list.open('?size=100');
    await list.loaded();
    const pages = Math.ceil((await list.totalCount()) / 100);

    // Whatever the order of the list, and the users that the earlier runs have left.
    const row = list.rowOf(ADMIN.email);
    for (let number = 1; number < pages && (await row.count()) === 0; number++) {
      await list.next.click();
      await expect(page).toHaveURL(`/users?page=${number + 1}&size=100`);
      await list.loaded();
    }
    await expect(row).toHaveCount(1);
    await expect(row.locator('td').last()).toHaveText('ADMIN');
  });

  test('gives a user without the permission no tab, and the refusal of the backend', async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);
    await signIn(page, email);
    const header = new AppHeader(page);
    await expect(header.profileTab).toBeVisible();
    await expect(header.usersTab).toHaveCount(0);

    await new UsersPage(page).open();

    await expect(page.getByRole('alert')).toHaveText('You do not have permission to manage users.');
  });
});
