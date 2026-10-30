import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthSessionService } from './auth/auth-session.service';
import { CurrentUser, Role } from './auth/auth.model';
import { CurrentUserService } from './auth/current-user.service';

describe('AppComponent', () => {
  // When `/me` is called and what its answers give is the business of `CurrentUserService`;
  // here only what the header shows for a given user.
  const user = signal<CurrentUser | null>(null);

  beforeEach(() => {
    localStorage.removeItem('droso.session');
    user.set(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CurrentUserService, useValue: { user } }],
    });
  });

  afterEach(() => localStorage.removeItem('droso.session'));

  function itemsOf(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('nav a, nav .role, nav button'), (item) => item.textContent!.trim());
  }

  function userWithRole(role: Role): CurrentUser {
    return { id: 1, email: 'qwe@gmail.com', role, permissions: [], createdAt: '2026-10-27T10:15:30Z' };
  }

  it('offers to sign in or to sign up without a session', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(itemsOf(fixture.nativeElement)).toEqual(['Service health', 'Sign in', 'Sign up']);
  });

  it('signs out with the button of the header', () => {
    const session = TestBed.inject(AuthSessionService);
    session.save('eyJ.x.y', 1800);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(itemsOf(fixture.nativeElement)).toEqual(['Service health', 'Sign out']);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('nav button')!.click();
    fixture.detectChanges();

    expect(session.isAuthenticated()).toBeFalse();
    expect(itemsOf(fixture.nativeElement)).toEqual(['Service health', 'Sign in', 'Sign up']);
  });

  for (const role of ['USER', 'MANAGER', 'ADMIN'] as const) {
    it(`shows the role ${role} before the sign-out`, () => {
      TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
      user.set(userWithRole(role));
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      expect(itemsOf(fixture.nativeElement)).toEqual(['Service health', `Role: ${role}`, 'Sign out']);
    });
  }

  it('shows no role once the token has expired', () => {
    const now = Date.now();
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    user.set(userWithRole('ADMIN'));
    spyOn(Date, 'now').and.returnValue(now + 1801 * 1000);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(itemsOf(fixture.nativeElement)).toEqual(['Service health', 'Sign in', 'Sign up']);
  });
});
