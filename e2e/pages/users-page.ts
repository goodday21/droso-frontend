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

  /** The list has the answer for the URL: the rows of the previous page stay while it loads. */
  async loaded(): Promise<void> {
    await expect(this.page.locator('section[aria-busy="false"]')).toBeVisible();
  }

  /** The row of the user, by the email as it is read out: whole, however it is cut on the screen. */
  rowOf(email: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) });
  }

  /** The number of the users, once the list has loaded: the end of `… of 45`. */
  async totalCount(): Promise<number> {
    return Number((await this.shown.textContent())!.match(/of\s+(\d+)\s*$/)![1]);
  }
}
