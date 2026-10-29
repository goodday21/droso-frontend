import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { expect, test } from '../support/fixtures';
import { apiError, userCreated } from '../support/responses';

const EMAIL = 'qwe@gmail.com';
const PASSWORD = 'Sup3r-Secret!';

test.describe('Sign-up page', () => {
  let registerPage: RegisterPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    loginPage = new LoginPage(page);
    await registerPage.open();
  });

  test('requires both fields and sends nothing', async ({ api }) => {
    await registerPage.submit.click();

    await expect(registerPage.fieldErrors('email')).toHaveText(['is required']);
    await expect(registerPage.fieldErrors('password')).toHaveText(['is required']);
    expect(api.requests('register')).toEqual([]);
  });

  test('limits the length of both fields and sends nothing', async ({ api }) => {
    await registerPage.fill(`${'a'.repeat(245)}@gmail.com`, `${'Aa1!'.repeat(16)}x`);
    await registerPage.submit.click();

    await expect(registerPage.fieldErrors('email')).toHaveText(['must be at most 254 characters']);
    await expect(registerPage.fieldErrors('password')).toHaveText(['must be at most 64 characters']);
    expect(api.requests('register')).toEqual([]);
  });

  test('opens the sign-in page with the email of the response', async ({ page, api }) => {
    // The backend lowers the email: the page shows the stored one, not the one typed.
    api.respond('register', userCreated(EMAIL));

    await registerPage.fill('Qwe@Gmail.com', PASSWORD);
    await registerPage.submit.click();

    const login = new LoginPage(page);
    await expect(page).toHaveURL('/login?registered=1');
    await expect(login.registered).toHaveText('Registration complete. Please sign in.');
    await expect(login.email).toHaveValue(EMAIL);
    await expect(login.password).toHaveValue('');
    expect(api.requests('register')).toEqual([{ email: 'Qwe@Gmail.com', password: PASSWORD }]);
  });

  test('lists every rule of the password that the backend reports', async ({ api }) => {
    api.respond(
      'register',
      apiError(400, 'VALIDATION_ERROR', { password: 'must contain a digit; must contain an upper case letter' }),
    );

    await registerPage.fill(EMAIL, 'secret-word');
    await registerPage.submit.click();

    await expect(registerPage.fieldErrors('password')).toHaveText([
      'must contain a digit',
      'must contain an upper case letter',
    ]);
    await expect(registerPage.password).toHaveClass(/invalid/);
    await expect(registerPage.alert).toBeHidden();
  });

  test('offers to sign in when the email is already registered', async ({ page, api }) => {
    api.respond('register', apiError(409, 'EMAIL_ALREADY_REGISTERED', { email: 'is already registered' }));

    await registerPage.fill(EMAIL, PASSWORD);
    await registerPage.submit.click();

    await expect(registerPage.fieldErrors('email')).toHaveText(['is already registered']);
    await expect(registerPage.alert).toBeHidden();

    await registerPage.signInInstead.click();
    await expect(page).toHaveURL('/login');

    await expect(loginPage.alert).toBeHidden();
    await expect(loginPage.fieldErrors('email')).toHaveCount(0);
    await expect(loginPage.email).not.toHaveClass('invalid');
    await expect(loginPage.fieldErrors('password')).toHaveCount(0);
    await expect(loginPage.password).not.toHaveClass('invalid');
  });

  test('sends one request while the first one is pending', async ({ page, api }) => {
    const release = api.hold('register', userCreated(EMAIL));

    await registerPage.fill(EMAIL, PASSWORD);
    await registerPage.submit.click();
    await expect(registerPage.submit).toHaveText('Signing up…');
    await expect(registerPage.submit).toBeDisabled();

    await registerPage.submitAgain();
    release();

    await expect(page).toHaveURL('/login?registered=1');
    expect(api.requests('register')).toHaveLength(1);
  });
});
