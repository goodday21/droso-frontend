import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSessionService } from './auth/auth-session.service';
import { CurrentUserService } from './auth/current-user.service';
import { RefreshTokenService } from './auth/refresh-token.service';
import { HeaderEmailComponent } from './header/header-email.component';
import { HeaderRoleComponent } from './header/header-role.component';
import { HEADER_TABS } from './header/header-tabs';

/**
 * The header of every page, then the page.
 *
 * A signed-in user gets the tabs of the pages ({@link HEADER_TABS}) on the left, and on the right
 * the email, the role and *Sign out*. *Sign out* stays at the right edge, the role right before it
 * as wide as its text, and the email, in a box of a fixed width, right before the role; until `/me`
 * answers the email and the role are empty. A guest gets *Sign in* and *Sign up* on the right.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeaderEmailComponent, HeaderRoleComponent],
  template: `
    <main class="page">
      <header class="header">
        <nav class="tabs" aria-label="Pages">
          @if (session.isAuthenticated()) {
            @for (tab of tabs; track tab.path) {
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
            <button type="button" (click)="signOut()">Sign out</button>
          } @else {
            <a routerLink="/login">Sign in</a>
            <a routerLink="/register">Sign up</a>
          }
        </div>
      </header>
      <router-outlet />
    </main>
  `,
  styles: [
    `
      .page {
        max-width: 40rem;
        margin: 0 auto;
      }
      /* The account stays on the right; on a narrow screen it wraps below the tabs. */
      .header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem 1rem;
      }
      .tabs,
      .account {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .account {
        margin-left: auto;
        gap: 1rem;
      }
      /* One space between the email and the role, so that they read as one line. */
      .user {
        display: flex;
        gap: 0.3em;
      }
      .tab {
        padding: 0.5rem 1rem;
        border: 1px solid #cbd2d9;
        border-radius: 6px;
        background: #fff;
        color: inherit;
        text-decoration: none;
      }
      .tab:hover {
        background: #e4e7eb;
      }
      .tab.active {
        border-color: #1f2933;
        background: #1f2933;
        color: #fff;
      }
    `,
  ],
})
export class AppComponent {
  protected readonly session = inject(AuthSessionService);
  protected readonly currentUser = inject(CurrentUserService);
  private readonly refresher = inject(RefreshTokenService);
  private readonly router = inject(Router);

  protected readonly tabs = HEADER_TABS;

  /** The session is gone at once; the backend revokes the refresh cookie in the background. */
  protected signOut(): void {
    void this.refresher.logout();
    void this.router.navigateByUrl('/login');
  }
}
