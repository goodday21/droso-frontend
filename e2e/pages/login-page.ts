import { Locator, Page } from '@playwright/test';
import { AuthFormPage } from './auth-form-page';

export class LoginPage extends AuthFormPage {
  /** The message shown after a registration. */
  readonly registered: Locator;

  constructor(page: Page) {
    super(page, '/login');
    this.registered = page.getByRole('status');
  }
}
