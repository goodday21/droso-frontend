import { Locator, Page } from '@playwright/test';

/**
 * The header at the top of every page. A signed-in user gets the tabs of the pages on the left, and
 * the email, the role and *Sign out* on the right; a guest gets *Sign in* and *Sign up*.
 */
export class AppHeader {
  readonly profileTab: Locator;
  readonly email: Locator;
  readonly role: Locator;
  readonly signIn: Locator;
  readonly signUp: Locator;
  readonly signOut: Locator;

  constructor(page: Page) {
    const header = page.locator('header');
    this.profileTab = header.getByRole('navigation').getByRole('link', { name: 'User Profile' });
    this.email = header.locator('app-header-email');
    this.role = header.locator('app-header-role');
    this.signIn = header.getByRole('link', { name: 'Sign in' });
    this.signUp = header.getByRole('link', { name: 'Sign up' });
    this.signOut = header.getByRole('button', { name: 'Sign out' });
  }
}
