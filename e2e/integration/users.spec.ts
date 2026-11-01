import { expect, test } from '@playwright/test';
import { AppHeader } from '../pages/app-header';
import { UsersPage } from '../pages/users-page';
import { ADMIN, createUser, signIn, uniqueEmail } from '../support/backend';

// `test` of Playwright itself, not of `support/fixtures`: these tests talk to the real backend.
// The administrator is checked by `backend.setup.ts`. The order is checked as the backend gives
// it, not the users in it: the earlier runs leave users behind.

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
    await expect(page).toHaveURL('/users?page=1&size=1&sort=id&direction=desc');
    await list.loaded();
    await expect(list.pages).toHaveText(`Pages ${await list.totalCount()}`);
    await expect(list.rows).toHaveCount(1);
    await list.next.click();
    await expect(page).toHaveURL('/users?page=2&size=1&sort=id&direction=desc');
    await expect(list.rows).toHaveCount(1);
  });

  test('shows the administrator with the role ADMIN', async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password);
    const list = new UsersPage(page);

    // `ADMIN` < `MANAGER` < `USER`: the administrators first, whatever the earlier runs left.
    await list.open('?size=100&sort=role&direction=asc');
    await list.loaded();

    const row = list.rowOf(ADMIN.email);
    await expect(row).toHaveCount(1);
    await expect(row.locator('td').last()).toHaveText('ADMIN');
  });

  test('lists the newest first, and the emails in the order of the backend on a click', async ({ page, request }) => {
    const newest = uniqueEmail();
    await createUser(request, newest);
    await signIn(page, ADMIN.email, ADMIN.password);
    const list = new UsersPage(page);

    await list.open('?size=100');
    await list.loaded();
    const ids = await list.ids();
    expect(ids, 'the newest first').toEqual([...ids].sort((a, b) => b - a));

    await list.sortBy('Email');

    await expect(page).toHaveURL('/users?page=1&size=100&sort=email&direction=asc');
    // The URL changes before the page asks: the mark of the column comes with the request.
    await expect(list.columnHead('Email')).toHaveAttribute('aria-sort', 'ascending');
    await list.loaded();
    const emails = await list.emails();
    // Byte by byte, as the collation `C` of the backend: the emails are ASCII.
    expect(emails).toEqual([...emails].sort());
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
