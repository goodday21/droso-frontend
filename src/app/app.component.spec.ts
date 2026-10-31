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

  // The place of the email is always there, so that the other items stay on the right; it counts
  // as an item only when it shows an email.
  function itemsOf(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('nav .email, nav a, nav .role, nav button'), (item) =>
      item.textContent!.trim(),
    ).filter((text) => text !== '');
  }

  function emailOf(element: HTMLElement): HTMLElement {
    return element.querySelector<HTMLElement>('nav .email')!;
  }

  function userWithRole(role: Role): CurrentUser {
    return { id: 1, email: 'qwe@gmail.com', role, permissions: [], createdAt: '2026-10-27T10:15:30Z' };
  }

  it('offers to sign in or to sign up without a session', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(itemsOf(fixture.nativeElement)).toEqual(['Sign in', 'Sign up']);
  });

  it('signs out with the button of the header', () => {
    const session = TestBed.inject(AuthSessionService);
    session.save('eyJ.x.y', 1800);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(itemsOf(fixture.nativeElement)).toEqual(['Sign out']);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('nav button')!.click();
    fixture.detectChanges();

    expect(session.isAuthenticated()).toBeFalse();
    expect(itemsOf(fixture.nativeElement)).toEqual(['Sign in', 'Sign up']);
  });

  for (const role of ['USER', 'MANAGER', 'ADMIN'] as const) {
    it(`shows the email, then the role ${role} before the sign-out`, () => {
      TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
      user.set(userWithRole(role));
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      expect(itemsOf(fixture.nativeElement)).toEqual(['qwe@gmail.com', `Role: ${role}`, 'Sign out']);
    });
  }

  it('gives the full email as the hint of the email', () => {
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    user.set(userWithRole('USER'));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(emailOf(fixture.nativeElement).title).toBe('qwe@gmail.com');
  });

  it('gives no hint without a session', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(emailOf(fixture.nativeElement).hasAttribute('title')).toBeFalse();
  });

  it('shows neither the email nor the role once the token has expired', () => {
    const now = Date.now();
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);
    user.set(userWithRole('ADMIN'));
    spyOn(Date, 'now').and.returnValue(now + 1801 * 1000);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(itemsOf(fixture.nativeElement)).toEqual(['Sign in', 'Sign up']);
  });
});
