import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { HealthPageComponent } from '../health/health-page.component';
import { AuthSessionService } from './auth-session.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let harness: RouterTestingHarness;
  let page: LoginPageComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem('droso.session');
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl('/login', LoginPageComponent);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('droso.session');
  });

  function element(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function fillAndSubmit(email = 'qwe@gmail.com', password = 'Sup3r-Secret!'): void {
    page.form.setValue({ email, password });
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    harness.detectChanges();
  }

  function errorsOf(field: string): string[] {
    const items = element().querySelectorAll(`.errors[data-field="${field}"] li`);
    return Array.from(items, (item) => item.textContent!.trim());
  }

  it('shows no message of a registration or of an expired session when opened directly', () => {
    expect(element().textContent).not.toContain('Registration complete');
    expect(element().textContent).not.toContain('session has ended');
  });

  it('tells that the session has expired when the backend ended it', async () => {
    // Via another page: the router would reuse the page that is open and keep its snapshot.
    await harness.navigateByUrl('/register');
    await harness.navigateByUrl('/login?expired=1', LoginPageComponent);

    expect(element().querySelector('[role="status"]')!.textContent!.trim()).toBe(
      'Your session has ended. Please sign in again.',
    );
  });

  it('keeps the token and opens the health page after a login', async () => {
    fillAndSubmit();
    const request = httpMock.expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({ email: 'qwe@gmail.com', password: 'Sup3r-Secret!' });
    request.flush({ accessToken: 'eyJ.x.y', tokenType: 'Bearer', expiresIn: 1800 });
    await harness.fixture.whenStable();

    expect(TestBed.inject(AuthSessionService).accessToken()).toBe('eyJ.x.y');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(HealthPageComponent);
    // The health page checks the backend as soon as it opens.
    httpMock.expectOne('/api/v1/health');
  });

  it('tells that the credentials are invalid without naming a field, and clears the password', () => {
    fillAndSubmit();
    httpMock.expectOne('/api/v1/auth/login').flush(
      { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', fieldErrors: {} },
      { status: 401, statusText: 'Unauthorized' },
    );
    harness.detectChanges();

    expect(element().querySelector('[role=alert]')?.textContent).toContain('Invalid email or password');
    expect(page.form.controls.email.value).toBe('qwe@gmail.com');
    expect(page.form.controls.password.value).toBe('');
    expect(errorsOf('password')).toEqual([]);
    expect(TestBed.inject(AuthSessionService).isAuthenticated()).toBeFalse();
  });

  it('shows the validation errors of the backend under the fields', () => {
    fillAndSubmit();
    httpMock.expectOne('/api/v1/auth/login').flush(
      {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        fieldErrors: { email: 'must be at most 254 characters' },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    harness.detectChanges();

    expect(errorsOf('email')).toEqual(['must be at most 254 characters']);
  });

  it('does not read an answer of the proxy as an error of the backend, and keeps the password', () => {
    fillAndSubmit();
    httpMock
      .expectOne('/api/v1/auth/login')
      .flush('Error occurred while trying to proxy', { status: 504, statusText: 'Gateway Timeout' });
    harness.detectChanges();

    expect(element().querySelector('[role=alert]')?.textContent).toContain('try again later');
    expect(page.form.controls.password.value).toBe('Sup3r-Secret!');
  });

  it('does not show the message of an internal error, and keeps the password', () => {
    fillAndSubmit();
    httpMock.expectOne('/api/v1/auth/login').flush(
      { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', fieldErrors: {} },
      { status: 500, statusText: 'Internal Server Error' },
    );
    harness.detectChanges();

    expect(element().querySelector('[role=alert]')?.textContent).toContain('try again later');
    expect(page.form.controls.password.value).toBe('Sup3r-Secret!');
    expect(element().querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBeFalse();
  });

  it('tells that the service is not reachable', () => {
    fillAndSubmit();
    httpMock
      .expectOne('/api/v1/auth/login')
      .error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });
    harness.detectChanges();

    expect(element().querySelector('[role=alert]')?.textContent).toContain('not reachable');
  });

  it('does not send a password longer than the backend accepts', () => {
    fillAndSubmit('qwe@gmail.com', 'A'.repeat(65));

    httpMock.expectNone('/api/v1/auth/login');
    expect(errorsOf('password')).toEqual(['must be at most 64 characters']);
  });
});
