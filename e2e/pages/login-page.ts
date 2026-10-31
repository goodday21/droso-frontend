import { Locator, Page } from '@playwright/test';
import { AuthFormPage } from './auth-form-page';

export class LoginPage extends AuthFormPage {
  /** The message shown after a registration. */
  readonly registered: Locator;
  /** The message shown when the backend has ended the session. */
  readonly expired: Locator;

  constructor(page: Page) {
    super(page, '/login');
    this.registered = page.getByRole('status').filter({ hasText: 'Registration complete' });
    this.expired = page.getByRole('status').filter({ hasText: 'session has expired' });
  }
}
