import { Locator, Page, expect } from '@playwright/test';

/**
 * The list of the users, below the header of the application: its bar with *Back* and the title,
 * the table in its scrolling box, and the pager of Taiga UI (`tui-table-pagination`): the number
 * of the pages, the rows shown out of all, which opens the menu of the sizes, and the previous and
 * the next page.
 */
export class UsersPage {
  readonly heading: Locator;
  readonly back: Locator;
  /** The box of the table, which scrolls once the table reaches the bottom of the window. */
  readonly scroll: Locator;
  /** A cell of the head of the table, which sticks to the top of its box. */
  readonly head: Locator;
  readonly rows: Locator;
  readonly pager: Locator;
  /** The number of the pages: `Pages 3`. */
  readonly pages: Locator;
  /** The rows shown out of all: `Lines per page 21–40 of 45`. */
  readonly shown: Locator;
  /** The button of the rows shown, `21–40`, which opens the menu of the sizes. */
  readonly sizes: Locator;
  readonly previous: Locator;
  readonly next: Locator;
  /** The dialog that asks to delete a user, and its Yes; or to change the role, and its Update. */
  readonly dialog: Locator;
  readonly confirm: Locator;
  readonly update: Locator;
  /** The menu of the roles in the dialog of the change of the role. */
  readonly roleSelect: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.back = page.getByRole('button', { name: 'Back' });
    this.scroll = page.locator('.scroll');
    this.head = this.scroll.getByRole('columnheader', { name: 'Email' });
    this.rows = this.scroll.locator('tbody tr');
    this.pager = page.locator('tui-table-pagination');
    this.pages = this.pager.locator('span').filter({ hasText: /^\s*Pages\s+\d+\s*$/ });
    // The hook of Taiga UI for the tests of its users.
    this.shown = this.pager.locator('[automation-id="tui-table-pagination__lines-per-page-wrapper"]');
    this.sizes = this.shown.getByRole('button');
    this.previous = this.pager.getByRole('button', { name: 'Previous' });
    this.next = this.pager.getByRole('button', { name: 'Next' });
    this.dialog = page.getByRole('dialog');
    this.confirm = this.dialog.getByRole('button', { name: 'Yes' });
    this.update = this.dialog.getByRole('button', { name: 'Update', exact: true });
    this.roleSelect = this.dialog.locator('input[tuiSelect]');
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`/users${query}`);
  }

  /**
   * Chooses the size of the page in the menu of the pager, and waits for the menu to close: until
   * its animation ends, a menu opened right after would be the second one on the page.
   */
  async selectSize(size: number): Promise<void> {
    await this.sizes.click();
    await this.page.getByRole('option', { name: String(size), exact: true }).click();
    await expect(this.page.getByRole('option')).toHaveCount(0);
  }

  /** The head of a column, whose button sorts the list by it; `aria-sort` marks the column sorted by. */
  columnHead(name: 'ID' | 'Email' | 'Role'): Locator {
    return this.scroll.getByRole('columnheader', { name, exact: true });
  }

  /** Sorts the list by the column, or the other way round when sorted by it already. */
  async sortBy(name: 'ID' | 'Email' | 'Role'): Promise<void> {
    await this.columnHead(name).getByRole('button').click();
  }

  /** The list has the answer for the URL: the rows of the previous page stay while it loads. */
  async loaded(): Promise<void> {
    await expect(this.page.locator('section[aria-busy="false"]')).toBeVisible();
  }

  /** The row of the user, by the email as it is read out: whole, however it is cut on the screen. */
  rowOf(email: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) });
  }

  /** The button in the last column that asks to delete the user; none in the row of the signed-in user. */
  deleteButton(email: string): Locator {
    return this.scroll.getByRole('button', { name: `Delete user ${email}`, exact: true });
  }

  /** The button left of the deletion that asks to change the role; none in the row of the signed-in user. */
  updateRoleButton(email: string): Locator {
    return this.scroll.getByRole('button', { name: `Update role of user ${email}`, exact: true });
  }

  /** Opens the menu of the roles in the dialog and chooses one. */
  async chooseRole(role: 'ADMIN' | 'MANAGER' | 'USER'): Promise<void> {
    await this.roleSelect.click();
    await this.page.getByRole('option', { name: role, exact: true }).click();
  }

  /** The ids of the rows, from the top. */
  async ids(): Promise<number[]> {
    return (await this.rows.locator('td.id').allTextContents()).map((id) => Number(id.trim()));
  }

  /** The emails of the rows, from the top, whole: as read out, however they are cut on the screen. */
  async emails(): Promise<string[]> {
    return this.rows.evaluateAll((rows) =>
      rows.map((row) => row.querySelector('app-fit-email .whole')!.textContent!.trim()),
    );
  }

  /** The number of the users, once the list has loaded: the end of `… of 45`. */
  async totalCount(): Promise<number> {
    return Number((await this.shown.textContent())!.match(/of\s+(\d+)\s*$/)![1]);
  }
}
