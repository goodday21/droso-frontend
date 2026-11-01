import { Locator, Page, expect } from '@playwright/test';

/**
 * The list of the users, below the header of the application: its bar with *Back* and the title,
 * the table in its scrolling box, and the pager.
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
  readonly position: Locator;
  readonly total: Locator;
  readonly next: Locator;
  readonly size: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.back = page.getByRole('button', { name: 'Back' });
    this.scroll = page.locator('.scroll');
    this.head = this.scroll.getByRole('columnheader', { name: 'Email' });
    this.rows = this.scroll.locator('tbody tr');
    this.pager = page.getByRole('navigation', { name: 'Pages of the list' });
    this.position = this.pager.getByText(/^Page \d+ of \d+$/);
    this.total = this.pager.getByText(/^Total: \d+$/);
    this.next = this.pager.getByRole('button', { name: 'Next' });
    this.size = this.pager.getByLabel('Rows per page');
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`/users${query}`);
  }

  /** The list has the answer for the URL: the rows of the previous page stay while it loads. */
  async loaded(): Promise<void> {
    await expect(this.page.locator('section[aria-busy="false"]')).toBeVisible();
  }

  /** The row of the user, by the email as it is read out: whole, however it is cut on the screen. */
  rowOf(email: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) });
  }

  /** The number of the users, once the list has loaded. */
  async totalCount(): Promise<number> {
    return Number((await this.total.textContent())!.replace('Total: ', ''));
  }
}
