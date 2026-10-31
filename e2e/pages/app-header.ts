import { Locator, Page } from '@playwright/test';

/**
 * The navigation at the top of every page; it shows the email, the role and *Sign out* only to a
 * signed-in user.
 */
export class AppHeader {
  readonly email: Locator;
  readonly signIn: Locator;
  readonly signUp: Locator;
  readonly role: Locator;
  readonly signOut: Locator;

  constructor(page: Page) {
    const nav = page.locator('nav');
    this.email = nav.locator('.email');
    this.signIn = nav.getByRole('link', { name: 'Sign in' });
    this.signUp = nav.getByRole('link', { name: 'Sign up' });
    this.role = nav.getByText(/^Role: /);
    this.signOut = nav.getByRole('button', { name: 'Sign out' });
  }
}
