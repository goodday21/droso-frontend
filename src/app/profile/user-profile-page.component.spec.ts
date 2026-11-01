import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TuiRoot, provideTaiga } from '@taiga-ui/core';
import { ApiResult } from '../api/api-error';
import { CurrentUserService, CurrentUserState } from '../auth/current-user.service';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { UserProfilePageComponent } from './user-profile-page.component';

/** The page in the root of Taiga UI, where its dialog is shown, as in the application. */
@Component({
  standalone: true,
  imports: [TuiRoot, UserProfilePageComponent],
  template: `<tui-root><app-user-profile-page /></tui-root>`,
})
class HostComponent {}

describe('UserProfilePageComponent', () => {
  // When `/me` is called is the business of `CurrentUserService`, and the call of the sign-out
  // that of `RefreshTokenService`; the colour of the role that of `RoleBadgeComponent`. The dialog
  // is the one of Taiga UI: Escape and a click outside it, which it handles itself, are checked by
  // the browser tests. Here what the page shows and asks for.
  const state = signal<CurrentUserState>({ status: 'none' });
  let logoutAll: jasmine.Spy<() => Promise<ApiResult<null>>>;
  let fixture: ComponentFixture<HostComponent>;
  let navigateByUrl: jasmine.Spy;

  beforeEach(() => {
    state.set({
      status: 'loaded',
      user: { id: 1, email: 'qwe@gmail.com', role: 'MANAGER', permissions: [], createdAt: '2026-10-27T10:15:30Z' },
    });
    logoutAll = jasmine.createSpy('logoutAll');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CurrentUserService,
          useValue: { state, user: () => (state().status === 'loaded' ? (state() as { user: unknown }).user : null) },
        },
        { provide: RefreshTokenService, useValue: { logoutAll } },
        provideTaiga(),
      ],
    });
    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function page(): HTMLElement {
    return element().querySelector('app-user-profile-page')!;
  }

  function button(name: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll('button')).find(
      (candidate) => candidate.textContent!.trim() === name,
    );
    expect(found).withContext(`the button ${name}`).toBeDefined();
    return found!;
  }

  function rows(): string[][] {
    return Array.from(page().querySelectorAll('table tr'), (row) =>
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

  /** Lets the promises settle and the dialog play its animation, in or out. */
  async function settle(): Promise<void> {
    for (let wait = 0; wait < 20; wait++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  }

  // Sign out is in the header of the application (`AppComponent`), not on the page.
  // What Back does is the business of `PageBarComponent`.
  it('shows Back and its title in its bar, without a sign-out', () => {
    const bar = page().querySelector('app-page-bar')!;

    expect(Array.from(bar.children, (item) => item.textContent!.trim())).toEqual(['Back', 'User profile']);
    expect(Array.from(page().querySelectorAll('button'), (item) => item.textContent!.trim())).not.toContain(
      'Sign out',
    );
  });

  it('shows the email and the role of the user in a table, the role as a badge', () => {
    expect(rows()).toEqual([
      ['Email:', 'qwe@gmail.com'],
      ['Role:', 'MANAGER'],
    ]);
    expect(page().querySelector('table app-role-badge')).not.toBeNull();
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

    expect(page().querySelector('table')).toBeNull();
    expect(page().querySelector('[role="alert"]')!.textContent!.trim()).toBe('Could not load the profile.');
    expect(button('Logout all sessions')).toBeTruthy();
  });

  describe('Logout all sessions', () => {
    beforeEach(async () => {
      click(button('Logout all sessions'));
      await settle();
    });

    it('asks first in a dialog, with the focus on Cancel', () => {
      expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('Logout all sessions?');
      expect(dialog()!.textContent).toContain('You will be signed out on every device, this one included.');
      expect(document.activeElement).toBe(button('Cancel'));
      expect(logoutAll).not.toHaveBeenCalled();
    });

    it('closes without a call on Cancel', async () => {
      click(button('Cancel'));
      await settle();

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
      await settle();

      click(button('Logout all sessions'));
      await settle();

      expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
