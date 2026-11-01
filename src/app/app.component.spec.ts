import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { AppComponent } from './app.component';
import { AuthSessionService } from './auth/auth-session.service';
import { CurrentUser, Role } from './auth/auth.model';
import { CurrentUserService } from './auth/current-user.service';
import { RefreshTokenService } from './auth/refresh-token.service';

describe('AppComponent', () => {
  // When `/me` is called and what its answers give is the business of `CurrentUserService`; how the
  // email is cut and the role written, that of the components of the header. Here only what the
  // header holds, and in which order.
  const user = signal<CurrentUser | null>(null);
  let logout: jasmine.Spy;

  beforeEach(() => {
    localStorage.removeItem('droso.session');
    user.set(null);
    // The sign-out itself (the session, the cookie, the lock) is the business of `RefreshTokenService`.
    logout = jasmine.createSpy('logout').and.callFake(async () => TestBed.inject(AuthSessionService).clear());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'user-profile', children: [] },
          { path: 'users', children: [] },
        ]),
        { provide: CurrentUserService, useValue: { user } },
        { provide: RefreshTokenService, useValue: { logout } },
        provideTaiga(),
      ],
    });
  });

  afterEach(() => localStorage.removeItem('droso.session'));

  function render(): ComponentFixture<AppComponent> {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture;
  }

  /** The texts of the header from left to right, without the empty boxes of the email and the role. */
  function itemsOf(fixture: ComponentFixture<AppComponent>): string[] {
    const header = (fixture.nativeElement as HTMLElement).querySelector('header')!;
    return Array.from(header.querySelectorAll('a, app-header-email, app-header-role, button'), (item) =>
      item.textContent!.trim(),
    ).filter((text) => text !== '');
  }

  function tabOf(fixture: ComponentFixture<AppComponent>): HTMLAnchorElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('nav a')!;
  }

  function userWithRole(role: Role, permissions: string[] = []): CurrentUser {
    return { id: 1, email: 'qwe@gmail.com', role, permissions, createdAt: '2026-10-27T10:15:30Z' };
  }

  it('offers to sign in or to sign up without a session, without tabs', () => {
    const fixture = render();

    expect(itemsOf(fixture)).toEqual(['Sign in', 'Sign up']);
    expect(tabOf(fixture)).toBeNull();
  });

  for (const role of ['USER', 'MANAGER', 'ADMIN'] as const) {
    it(`shows the tabs, then the email, the role ${role} and Sign out`, () => {
      TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
      user.set(userWithRole(role));

      expect(itemsOf(render())).toEqual(['User Profile', 'qwe@gmail.com', role, 'Sign out']);
    });
  }

  // The permission decides, not the role: which role has it is the business of the backend.
  it('shows the tab Users, first, only to a user with the permission USER_MANAGE', () => {
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    user.set(userWithRole('MANAGER', ['DEFECT_READ', 'DEFECT_CREATE', 'DEFECT_UPDATE']));
    const fixture = render();
    expect(itemsOf(fixture)).toEqual(['User Profile', 'qwe@gmail.com', 'MANAGER', 'Sign out']);

    user.set(userWithRole('ADMIN', ['DEFECT_READ', 'USER_MANAGE']));
    fixture.detectChanges();

    expect(itemsOf(fixture)).toEqual(['Users', 'User Profile', 'qwe@gmail.com', 'ADMIN', 'Sign out']);
    expect(tabOf(fixture).getAttribute('href')).toBe('/users');
  });

  it('keeps the places of the email and the role, empty, until the user is known', () => {
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    expect(itemsOf(fixture)).toEqual(['User Profile', 'Sign out']);
    expect(element.querySelector('app-header-email')).not.toBeNull();
    expect(element.querySelector('app-header-role')).not.toBeNull();
  });

  it('opens the profile with its tab, which is marked while the profile is open', async () => {
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    const router = TestBed.inject(Router);
    const fixture = render();
    await router.navigateByUrl('/');
    fixture.detectChanges();
    const tab = tabOf(fixture);
    expect(tab.getAttribute('href')).toBe('/user-profile');
    expect(tab.classList).not.toContain('active');
    expect(tab.hasAttribute('aria-current')).toBeFalse();

    tab.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/user-profile');
    expect(tab.classList).toContain('active');
    expect(tab.getAttribute('aria-current')).toBe('page');
  });

  it('signs out with the button of the header and opens the sign-in', () => {
    const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    const fixture = render();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('header button')!.click();
    fixture.detectChanges();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledOnceWith('/login');
    expect(itemsOf(fixture)).toEqual(['Sign in', 'Sign up']);
  });

  it('shows neither the tabs nor the user once the token has expired', () => {
    const now = Date.now();
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    user.set(userWithRole('ADMIN'));
    spyOn(Date, 'now').and.returnValue(now + 1801 * 1000);

    expect(itemsOf(render())).toEqual(['Sign in', 'Sign up']);
  });
});
