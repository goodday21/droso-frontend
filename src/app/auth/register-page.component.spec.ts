import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LoginPageComponent } from './login-page.component';
import { RegisterPageComponent } from './register-page.component';

describe('RegisterPageComponent', () => {
  let harness: RouterTestingHarness;
  let page: RegisterPageComponent;
  let httpMock: HttpTestingController;

  const apiError = (status: number, code: string, fieldErrors: Record<string, string> = {}) => ({
    status,
    code,
    message: `message of ${code}`,
    fieldErrors,
  });

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl('/register', RegisterPageComponent);
  });

  afterEach(() => httpMock.verify());

  function element(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function fillAndSubmit(email = 'qwe@gmail.com', password = 'Sup3r-Secret!'): void {
    page.form.setValue({ email, password });
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    harness.detectChanges();
  }

  function answer(body: object, status: number): void {
    httpMock.expectOne('/api/v1/auth/register').flush(body, { status, statusText: 'Error' });
    harness.detectChanges();
  }

  function errorsOf(field: string): string[] {
    const items = element().querySelectorAll(`.errors[data-field="${field}"] li`);
    return Array.from(items, (item) => item.textContent!.trim());
  }

  it('does not send an empty form and tells what is missing', () => {
    fillAndSubmit('', '');

    httpMock.expectNone('/api/v1/auth/register');
    expect(errorsOf('email')).toEqual(['is required']);
    expect(errorsOf('password')).toEqual(['is required']);
  });

  it('opens the sign-in page with the email and a message after a registration', async () => {
    fillAndSubmit('Qwe@Gmail.com');
    answer({ id: 1, email: 'qwe@gmail.com', role: 'USER', createdAt: '2026-10-27T10:15:30Z' }, 201);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/login?registered=1');
    const login = harness.routeDebugElement!.componentInstance as LoginPageComponent;
    expect(login).toBeInstanceOf(LoginPageComponent);
    expect(login.form.controls.email.value).toBe('qwe@gmail.com');
    expect(element().textContent).toContain('Registration complete');
  });

  it('shows every violated rule of the password under the field', () => {
    fillAndSubmit('qwe@gmail.com', 'secret');
    answer(
      apiError(400, 'VALIDATION_ERROR', {
        password: 'must be at least 8 characters; must contain an upper case letter',
      }),
      400,
    );

    expect(errorsOf('password')).toEqual(['must be at least 8 characters', 'must contain an upper case letter']);
    expect(element().querySelector('[role=alert]')).toBeNull();
  });

  it('drops the error of the server when the field is edited', () => {
    fillAndSubmit();
    answer(apiError(400, 'VALIDATION_ERROR', { password: 'must contain a digit' }), 400);

    page.form.controls.password.setValue('Sup3r-Secret!!');
    harness.detectChanges();

    expect(errorsOf('password')).toEqual([]);
  });

  it('offers to sign in when the email is already registered', () => {
    fillAndSubmit();
    answer(apiError(409, 'EMAIL_ALREADY_REGISTERED', { email: 'is already registered' }), 409);

    expect(errorsOf('email')).toEqual(['is already registered']);
    expect(element().querySelector('.field a[href="/login"]')?.textContent).toContain('Sign in instead');
  });

  it('tells that the registration is disabled and disables the button', () => {
    fillAndSubmit();
    answer(apiError(403, 'REGISTRATION_DISABLED'), 403);

    expect(element().querySelector('[role=alert]')?.textContent).toContain('Registration is currently disabled');
    expect(element().querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBeTrue();
  });

  it('shows an error of a field that the form does not have above the form', () => {
    fillAndSubmit();
    answer(apiError(400, 'VALIDATION_ERROR', { role: 'is not allowed' }), 400);

    const alert = element().querySelector('[role=alert]')?.textContent ?? '';
    expect(alert).toContain('message of VALIDATION_ERROR');
    expect(alert).toContain('role is not allowed');
  });

  it('does not show the message of an internal error', () => {
    fillAndSubmit();
    answer(apiError(500, 'INTERNAL_ERROR'), 500);

    expect(element().querySelector('[role=alert]')?.textContent).toContain('try again later');
  });

  it('tells that the service is not reachable', () => {
    fillAndSubmit();
    httpMock
      .expectOne('/api/v1/auth/register')
      .error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });
    harness.detectChanges();

    expect(element().querySelector('[role=alert]')?.textContent).toContain('not reachable');
  });

  it('disables the button while the request runs', () => {
    fillAndSubmit();
    const button = element().querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Signing up');

    page.submit();
    httpMock.expectOne('/api/v1/auth/register');
  });
});
