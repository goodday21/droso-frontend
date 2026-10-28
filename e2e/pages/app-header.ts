import { Locator, Page } from '@playwright/test';

/** The navigation at the top of every page; it shows *Sign out* only to a signed-in user. */
export class AppHeader {
  readonly serviceHealth: Locator;
  readonly signIn: Locator;
  readonly signUp: Locator;
  readonly signOut: Locator;

  constructor(page: Page) {
    const nav = page.locator('nav');
    this.serviceHealth = nav.getByRole('link', { name: 'Service health' });
    this.signIn = nav.getByRole('link', { name: 'Sign in' });
    this.signUp = nav.getByRole('link', { name: 'Sign up' });
    this.signOut = nav.getByRole('button', { name: 'Sign out' });
  }
}
