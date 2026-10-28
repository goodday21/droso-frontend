import { LoginPage } from '../pages/login-page';
import { RegisterPage } from '../pages/register-page';
import { expect, test } from '../support/fixtures';
import { apiError, networkFailure, proxyError, userCreated } from '../support/responses';

const EMAIL = 'qwe@gmail.com';
const PASSWORD = 'Sup3r-Secret!';

test.describe('Sign-up page', () => {
  let register: RegisterPage;

  test.beforeEach(async ({ page }) => {
    register = new RegisterPage(page);
    await register.open();
  });

  test('requires both fields and sends nothing', async ({ api }) => {
    await register.submit.click();

    await expect(register.fieldErrors('email')).toHaveText(['is required']);
    await expect(register.fieldErrors('password')).toHaveText(['is required']);
    expect(api.requests('register')).toEqual([]);
  });

  test('limits the length of both fields and sends nothing', async ({ api }) => {
    await register.fill(`${'a'.repeat(245)}@gmail.com`, `${'Aa1!'.repeat(16)}x`);
    await register.submit.click();

    await expect(register.fieldErrors('email')).toHaveText(['must be at most 254 characters']);
    await expect(register.fieldErrors('password')).toHaveText(['must be at most 64 characters']);
    expect(api.requests('register')).toEqual([]);
  });

  test('opens the sign-in page with the email of the response', async ({ page, api }) => {
    // The backend lowers the email: the page shows the stored one, not the one typed.
    api.respond('register', userCreated(EMAIL));

    await register.fill('Qwe@Gmail.com', PASSWORD);
    await register.submit.click();

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

    await register.fill(EMAIL, 'secret-word');
    await register.submit.click();

    await expect(register.fieldErrors('password')).toHaveText([
      'must contain a digit',
      'must contain an upper case letter',
    ]);
    await expect(register.password).toHaveClass(/invalid/);
    await expect(register.alert).toBeHidden();
  });

  test('drops an error of the backend once the field is edited', async ({ api }) => {
    api.respond('register', apiError(400, 'VALIDATION_ERROR', { email: 'must be a valid email address' }));

    await register.fill('qwe@gmail', PASSWORD);
    await register.submit.click();
    await expect(register.fieldErrors('email')).toHaveText(['must be a valid email address']);

    await register.email.fill(EMAIL);

    await expect(register.fieldErrors('email')).toHaveCount(0);
    await expect(register.email).not.toHaveClass(/invalid/);
  });

  test('offers to sign in when the email is already registered', async ({ page, api }) => {
    api.respond('register', apiError(409, 'EMAIL_ALREADY_REGISTERED', { email: 'is already registered' }));

    await register.fill(EMAIL, PASSWORD);
    await register.submit.click();

    await expect(register.fieldErrors('email')).toHaveText(['is already registered']);
    await expect(register.alert).toBeHidden();

    await register.signInInstead.click();
    await expect(page).toHaveURL('/login');
  });

  test('disables the form when the registration is disabled', async ({ api }) => {
    api.respond('register', apiError(403, 'REGISTRATION_DISABLED'));

    await register.fill(EMAIL, PASSWORD);
    await register.submit.click();

    await expect(register.alert).toHaveText('Registration is currently disabled.');
    await expect(register.submit).toBeDisabled();
  });

  for (const { failure, response } of [
    { failure: 'an internal error', response: apiError(500, 'INTERNAL_ERROR') },
    { failure: 'an answer that is not an API error', response: proxyError },
  ]) {
    test(`shows a general message on ${failure}`, async ({ api }) => {
      api.respond('register', response);

      await register.fill(EMAIL, PASSWORD);
      await register.submit.click();

      await expect(register.alert).toHaveText('Something went wrong. Please try again later.');
      await expect(register.submit).toBeEnabled();
    });
  }

  test('tells that the service is not reachable', async ({ api }) => {
    api.respond('register', networkFailure);

    await register.fill(EMAIL, PASSWORD);
    await register.submit.click();

    await expect(register.alert).toHaveText('The service is not reachable. Check your connection and try again.');
  });

  test('sends one request while the first one is pending', async ({ page, api }) => {
    const release = api.hold('register', userCreated(EMAIL));

    await register.fill(EMAIL, PASSWORD);
    await register.submit.click();
    await expect(register.submit).toHaveText('Signing up…');
    await expect(register.submit).toBeDisabled();

    await register.submitAgain();
    release();

    await expect(page).toHaveURL('/login?registered=1');
    expect(api.requests('register')).toHaveLength(1);
  });
});
