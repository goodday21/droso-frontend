import { Locator, Page } from '@playwright/test';
import { AuthFormPage } from './auth-form-page';

export class RegisterPage extends AuthFormPage {
  /** Shown under the email when it is already registered. */
  readonly signInInstead: Locator;

  constructor(page: Page) {
    super(page, '/register');
    this.signInInstead = page.getByRole('link', { name: 'Sign in instead' });
  }
}
