import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton, TuiRoot } from '@taiga-ui/core';
import { AuthSessionService } from './auth/auth-session.service';
import { CurrentUserService } from './auth/current-user.service';
import { RefreshTokenService } from './auth/refresh-token.service';
import { HeaderEmailComponent } from './header/header-email.component';
import { HeaderRoleComponent } from './header/header-role.component';
import { HEADER_TABS } from './header/header-tabs';

/**
 * The root of Taiga UI (`tui-root`), then the header of every page, a white bar across the whole
 * window, then the page, in a column in the middle.
 *
 * The header starts with the name of the application. A signed-in user gets the tabs of the pages
 * that the user may open ({@link HEADER_TABS}) next to it, and on the right the email after its
 * avatar, the role as a badge and *Sign out*. *Sign out* stays at the right edge, the role right
 * before it as wide as its badge, and the email, in a box of a fixed width, right before the role;
 * until `/me` answers the email and the role are empty. A guest gets *Sign in* and *Sign up* on
 * the right.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiRoot, TuiButton, HeaderEmailComponent, HeaderRoleComponent],
  template: `
    <tui-root>
      <main>
        <header class="header">
          <span class="brand"><span class="logo" aria-hidden="true">D</span>Droso</span>
          <nav class="tabs" aria-label="Pages">
            @if (session.isAuthenticated()) {
              @for (tab of tabs(); track tab.path) {
                <a class="tab" [routerLink]="tab.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{
                  tab.label
                }}</a>
              }
            }
          </nav>
          <div class="account">
            @if (session.isAuthenticated()) {
              @let user = currentUser.user();
              <span class="user">
                <app-header-email [email]="user?.email ?? null" />
                <app-header-role [role]="user?.role ?? null" />
              </span>
              <button tuiButton type="button" appearance="flat" size="s" iconStart="@tui.log-out" (click)="signOut()">
                Sign out
              </button>
            } @else {
              <a tuiButton appearance="flat" size="s" routerLink="/login">Sign in</a>
              <a tuiButton appearance="primary" size="s" routerLink="/register">Sign up</a>
            }
          </div>
        </header>
        <div class="content">
          <router-outlet />
        </div>
      </main>
    </tui-root>
  `,
  styles: [
    `
      /* The account stays on the right; on a narrow screen it wraps below the tabs. */
      .header {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem 2rem;
        min-height: 3.75rem;
        padding: 0 1.5rem;
        background: var(--tui-background-base);
        box-shadow: 0 1px 0 var(--tui-border-normal);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font: var(--tui-typography-heading-h6);
        color: var(--tui-text-primary);
      }
      .logo {
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 0.5rem;
        background: var(--tui-background-accent-1);
        color: var(--tui-text-primary-on-accent-1);
        font-size: 0.875rem;
      }
      .tabs {
        display: flex;
        gap: 0.25rem;
      }
      .tab {
        padding: 0.375rem 0.875rem;
        border-radius: 1rem;
        font: var(--tui-typography-body-m);
        font-weight: 500;
        color: var(--tui-text-secondary);
        text-decoration: none;
        transition:
          background 0.15s,
          color 0.15s;
      }
      .tab:hover {
        background: var(--tui-background-neutral-1);
        color: var(--tui-text-primary);
      }
      .tab.active {
        background: var(--tui-background-neutral-2);
        color: var(--tui-text-primary);
      }
      .account {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-left: auto;
      }
      /* The badge of the role a little apart from the email, so that they read as one line. */
      .user {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font: var(--tui-typography-body-m);
        color: var(--tui-text-secondary);
      }
      /* The header spans the window; the pages are a column in the middle of it. */
      .content {
        box-sizing: border-box;
        width: 100%;
        max-width: 56rem;
        margin: 0 auto;
        padding: 0 1.5rem 1.5rem;
      }
    `,
  ],
})
export class AppComponent {
  protected readonly session = inject(AuthSessionService);
  protected readonly currentUser = inject(CurrentUserService);
  private readonly refresher = inject(RefreshTokenService);
  private readonly router = inject(Router);

  /** The tabs that the user may open: one that needs a permission waits for `/me`. */
  protected readonly tabs = computed(() => {
    const permissions = this.currentUser.user()?.permissions ?? [];
    return HEADER_TABS.filter((tab) => tab.permission === undefined || permissions.includes(tab.permission));
  });

  /** The session is gone at once; the backend revokes the refresh cookie in the background. */
  protected signOut(): void {
    void this.refresher.logout();
    void this.router.navigateByUrl('/login');
  }
}
