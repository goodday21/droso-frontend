import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthSessionService } from './auth/auth-session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <main class="page">
      <nav class="nav">
        <a routerLink="/">Service health</a>
        <span class="spacer"></span>
        @if (session.isAuthenticated()) {
          <button type="button" (click)="session.clear()">Sign out</button>
        } @else {
          <a routerLink="/login">Sign in</a>
          <a routerLink="/register">Sign up</a>
        }
      </nav>
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
      .spacer {
        flex: 1;
      }
    `,
  ],
})
export class AppComponent {
  protected readonly session = inject(AuthSessionService);
}
