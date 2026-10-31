import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { LoginPageComponent } from './auth/login-page.component';
import { RegisterPageComponent } from './auth/register-page.component';
import { HealthPageComponent } from './health/health-page.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { AuthSessionService } from './auth/auth-session.service';
import { UserProfilePageComponent } from './profile/user-profile-page.component';

describe('routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('shows the health page at the root', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/', HealthPageComponent);

    expect(page).toBeInstanceOf(HealthPageComponent);
  });

  it('shows the sign-in and the sign-up pages', async () => {
    const harness = await RouterTestingHarness.create();

    expect(await harness.navigateByUrl('/login', LoginPageComponent)).toBeInstanceOf(LoginPageComponent);
    expect(await harness.navigateByUrl('/register', RegisterPageComponent)).toBeInstanceOf(RegisterPageComponent);
  });

  it('shows the profile to a signed-in user only, and sends a guest to the sign-in', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/user-profile');
    expect(TestBed.inject(Router).url).toBe('/login');

    TestBed.inject(AuthSessionService).save('eyJ.x.y', 900);
    const opening = harness.navigateByUrl('/user-profile', UserProfilePageComponent);
    // The guard waits for the backend to confirm the session.
    await new Promise((resolve) => setTimeout(resolve));
    const calls = TestBed.inject(HttpTestingController).match('/api/v1/auth/me');
    calls.at(-1)!.flush({ id: 1, email: 'qwe@gmail.com', role: 'USER', permissions: [], createdAt: '2026-10-27T10:15:30Z' });
    expect(await opening).toBeInstanceOf(UserProfilePageComponent);
    TestBed.inject(AuthSessionService).clear();
  });

  it('shows "Page not found" for any other path', async () => {
    const harness = await RouterTestingHarness.create();

    for (const url of ['/qwerty', '/api', '/qwerty/nested', '/login/nested']) {
      await harness.navigateByUrl(url, NotFoundComponent);
      expect(harness.routeNativeElement?.textContent).toContain('Page not found');
    }
  });
});
