import { Locator, Page } from '@playwright/test';

/**
 * The page of the account, below the header of the application: its bar with *Back* and the title,
 * and the dialog of *Logout all sessions*.
 */
export class UserProfilePage {
  readonly heading: Locator;
  readonly back: Locator;
  readonly logoutAll: Locator;
  readonly dialog: Locator;
  readonly confirm: Locator;
  readonly cancel: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.back = page.getByRole('button', { name: 'Back' });
    this.logoutAll = page.getByRole('button', { name: 'Logout all sessions' });
    this.dialog = page.getByRole('dialog');
    this.confirm = this.dialog.getByRole('button', { name: 'Yes' });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }

  async open(): Promise<void> {
    await this.page.goto('/user-profile');
  }

  /** The value in the row of the table, e.g. `value('Email:')`. */
  value(label: 'Email:' | 'Role:'): Locator {
    return this.page.locator('table tr').filter({ has: this.page.getByRole('rowheader', { name: label }) }).locator('td');
  }
}
