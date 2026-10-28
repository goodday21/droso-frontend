import { Locator, Page } from '@playwright/test';

/** What the sign-in and the sign-up pages share: the same two fields and the same messages. */
export abstract class AuthFormPage {
  readonly heading: Locator;
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  /** Its label changes while the request is pending, so it is found by its type. */
  readonly submit: Locator;
  /** The error shown above the form. */
  readonly alert: Locator;
  /** The link under the form to the other page. */
  readonly switchLink: Locator;

  protected constructor(
    readonly page: Page,
    private readonly path: string,
  ) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.form = page.locator('form');
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = this.form.locator('button[type="submit"]');
    this.alert = page.getByRole('alert');
    this.switchLink = page.locator('.switch').getByRole('link');
  }

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  /** The messages under the field, one per item. */
  fieldErrors(field: 'email' | 'password'): Locator {
    return this.page.locator(`ul.errors[data-field="${field}"] li`);
  }

  async fill(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
  }

  /**
   * Submits the form as a second click would, even while the button is disabled: a click on a
   * disabled button does nothing, which would not show that the page itself ignores the submit.
   */
  async submitAgain(): Promise<void> {
    await this.form.dispatchEvent('submit');
  }
}
