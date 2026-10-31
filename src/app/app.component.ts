import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthSessionService } from './auth/auth-session.service';
import { CurrentUserService } from './auth/current-user.service';
import { RefreshTokenService } from './auth/refresh-token.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <main class="page">
      @if (!ownHeader()) {
        <nav class="nav">
          <!-- Takes the free width, so the items after it stay on the right even without an email. -->
          @if (signedInUser(); as user) {
            <a class="email" routerLink="/user-profile" [title]="profileLabel(user.email)">{{ profileLabel(user.email) }}</a>
          } @else {
            <span class="email"></span>
          }
          @if (session.isAuthenticated()) {
            @if (currentUser.user(); as user) {
              <span class="role">Role: {{ user.role }}</span>
            }
            <button type="button" (click)="signOut()">Sign out</button>
          } @else {
            <a routerLink="/login">Sign in</a>
            <a routerLink="/register">Sign up</a>
          }
        </nav>
      }
      <router-outlet />
    </main>
  `,
  styles: [
    `
      .page {
        max-width: 40rem;
        margin: 0 auto;
      }
      .nav {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      /*
       * The email gets only the width left by the other items, which never shrink: a long one is
       * cut with an ellipsis rather than pushing the role and Sign out aside.
       */
      .email {
        flex: 1 1 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class AppComponent {
  protected readonly session = inject(AuthSessionService);
  protected readonly currentUser = inject(CurrentUserService);
  private readonly refresher = inject(RefreshTokenService);
  private readonly router = inject(Router);

  /** Whether the page that is open draws its own header instead of this one (`data.ownHeader`). */
  protected readonly ownHeader = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => hasOwnHeader(this.router.routerState.snapshot.root)),
    ),
    { initialValue: false },
  );

  protected profileLabel(email: string): string {
    return `User profile (${email})`;
  }

  /** The user shown in the header: none without a valid session, even if `/me` answered before. */
  protected signedInUser() {
    return this.session.isAuthenticated() ? this.currentUser.user() : null;
  }

  /** The session is gone at once; the backend revokes the refresh cookie in the background. */
  protected signOut(): void {
    void this.refresher.logout();
    void this.router.navigateByUrl('/login');
  }
}

function hasOwnHeader(route: ActivatedRouteSnapshot): boolean {
  let current: ActivatedRouteSnapshot | null = route;
  while (current) {
    if (current.data['ownHeader'] === true) {
      return true;
    }
    current = current.firstChild;
  }
  return false;
}
