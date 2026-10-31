import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Router, provideRouter } from '@angular/router';
import { ApiResult } from '../api/api-error';
import { CurrentUserService, CurrentUserState } from '../auth/current-user.service';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { UserProfilePageComponent } from './user-profile-page.component';

describe('UserProfilePageComponent', () => {
  // When `/me` is called is the business of `CurrentUserService`, and the calls of the sign-outs
  // that of `RefreshTokenService`; here only what the page shows and asks for.
  const state = signal<CurrentUserState>({ status: 'none' });
  let logout: jasmine.Spy;
  let logoutAll: jasmine.Spy<() => Promise<ApiResult<null>>>;
  let fixture: ComponentFixture<UserProfilePageComponent>;
  let navigateByUrl: jasmine.Spy;

  beforeEach(() => {
    state.set({
      status: 'loaded',
      user: { id: 1, email: 'qwe@gmail.com', role: 'MANAGER', permissions: [], createdAt: '2026-10-27T10:15:30Z' },
    });
    logout = jasmine.createSpy('logout').and.resolveTo();
    logoutAll = jasmine.createSpy('logoutAll');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CurrentUserService,
          useValue: { state, user: () => (state().status === 'loaded' ? (state() as { user: unknown }).user : null) },
        },
        { provide: RefreshTokenService, useValue: { logout, logoutAll } },
      ],
    });
    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(UserProfilePageComponent);
    fixture.detectChanges();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(name: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll('button')).find(
      (candidate) => candidate.textContent!.trim() === name,
    );
    expect(found).withContext(`the button ${name}`).toBeDefined();
    return found!;
  }

  function rows(): string[][] {
    return Array.from(element().querySelectorAll('table tr'), (row) =>
      Array.from(row.children, (cell) => cell.textContent!.trim()),
    );
  }

  function dialog(): HTMLElement | null {
    return element().querySelector('[role="dialog"]');
  }

  function click(target: HTMLElement): void {
    target.click();
    fixture.detectChanges();
  }

  /** Lets the promise of a sign-out settle. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  it('shows Back, its title and Sign out in its header', () => {
    const header = element().querySelector('header')!;

    expect(Array.from(header.children, (item) => item.textContent!.trim())).toEqual([
      '← Back',
      'User profile',
      'Sign out',
    ]);
  });

  it('shows the email and the role of the user in a table', () => {
    expect(rows()).toEqual([
      ['Email:', 'qwe@gmail.com'],
      ['Role:', 'MANAGER'],
    ]);
  });

  it('shows that the user is loading', () => {
    state.set({ status: 'loading' });
    fixture.detectChanges();

    expect(rows()).toEqual([
      ['Email:', 'Loading…'],
      ['Role:', 'Loading…'],
    ]);
  });

  it('tells that the profile could not be loaded, and still offers to log out everywhere', () => {
    state.set({ status: 'failed' });
    fixture.detectChanges();

    expect(element().querySelector('table')).toBeNull();
    expect(element().querySelector('[role="alert"]')!.textContent!.trim()).toBe('Could not load the profile.');
    expect(button('Logout all sessions')).toBeTruthy();
  });

  it('signs out and opens the sign-in', () => {
    click(button('Sign out'));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledOnceWith('/login');
  });

  describe('Back', () => {
    it('goes back to the page it was opened from', () => {
      spyOnProperty(TestBed.inject(Router), 'lastSuccessfulNavigation').and.returnValue(
        signal({ previousNavigation: {} } as never),
      );
      const back = spyOn(TestBed.inject(Location), 'back');

      click(button('← Back'));

      expect(back).toHaveBeenCalledTimes(1);
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('opens the root when the page was opened directly', () => {
      spyOnProperty(TestBed.inject(Router), 'lastSuccessfulNavigation').and.returnValue(
        signal({ previousNavigation: null } as never),
      );
      const back = spyOn(TestBed.inject(Location), 'back');

      click(button('← Back'));

      expect(back).not.toHaveBeenCalled();
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/');
    });
  });

  describe('Logout all sessions', () => {
    beforeEach(async () => {
      click(button('Logout all sessions'));
      await fixture.whenStable();
    });

    it('asks first, with the focus on Cancel', () => {
      expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('Logout all sessions?');
      expect(document.activeElement).toBe(button('Cancel'));
      expect(logoutAll).not.toHaveBeenCalled();
    });

    it('closes without a call on Cancel', () => {
      click(button('Cancel'));

      expect(dialog()).toBeNull();
      expect(logoutAll).not.toHaveBeenCalled();
    });

    it('closes without a call on Escape', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expect(logoutAll).not.toHaveBeenCalled();
    });

    it('closes without a call on a click outside the dialog, but not on one inside it', () => {
      click(dialog()!);
      expect(dialog()).withContext('a click inside').not.toBeNull();

      click(element().querySelector<HTMLElement>('.backdrop')!);
      expect(dialog()).toBeNull();
      expect(logoutAll).not.toHaveBeenCalled();
    });

    it('ends every session on Yes, then closes and opens the sign-in', async () => {
      let answer!: (result: ApiResult<null>) => void;
      logoutAll.and.returnValue(new Promise((resolve) => (answer = resolve)));

      click(button('Yes'));

      expect(logoutAll).toHaveBeenCalledTimes(1);
      expect(button('Signing out…').disabled).toBeTrue();
      expect(button('Cancel').disabled).toBeTrue();
      click(element().querySelector<HTMLElement>('.backdrop')!);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(dialog()).withContext('while the call is pending').not.toBeNull();

      answer({ ok: true, body: null });
      await settle();

      expect(dialog()).toBeNull();
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/login');
    });

    it('stays open with the error when the sessions could not be ended', async () => {
      logoutAll.and.resolveTo({ ok: false, failure: { kind: 'unreachable' } });

      click(button('Yes'));
      await settle();

      expect(dialog()!.querySelector('[role="alert"]')!.textContent!.trim()).toBe(
        'The service is not reachable. Check your connection and try again.',
      );
      expect(button('Yes').disabled).toBeFalse();
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('forgets the error of the last attempt when asked again', async () => {
      logoutAll.and.resolveTo({ ok: false, failure: { kind: 'unreachable' } });
      click(button('Yes'));
      await settle();
      click(button('Cancel'));

      click(button('Logout all sessions'));

      expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
