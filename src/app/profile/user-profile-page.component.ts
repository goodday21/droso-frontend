import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { failureMessage } from '../api/api-error';
import { CurrentUserService } from '../auth/current-user.service';
import { RefreshTokenService } from '../auth/refresh-token.service';

/**
 * The account of the signed-in user: the email and the role, and the sign-out of every session.
 *
 * The page has its own header (`data.ownHeader` of its route): Back, its title and Sign out, but
 * neither the email nor the role, which the page itself shows. Only a signed-in user opens it
 * (`authGuard`).
 *
 * *Logout all sessions* asks first, in a dialog of the page. The dialog closes on Cancel, on
 * Escape, on a click outside it, or once the backend has accepted Yes; while the call is pending
 * it stays.
 */
@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancelLogoutAll()' },
  template: `
    <header class="bar">
      <button type="button" class="back" (click)="back()">← Back</button>
      <h1>User profile</h1>
      <button type="button" class="sign-out" (click)="signOut()">Sign out</button>
    </header>

    <section class="card">
      @switch (currentUser.state().status) {
        @case ('failed') {
          <p class="alert alert--error" role="alert">Could not load the profile.</p>
        }
        @default {
          @let user = currentUser.user();
          <table class="details">
            <tbody>
              <tr>
                <th scope="row">Email:</th>
                <td class="value">{{ user?.email ?? 'Loading…' }}</td>
              </tr>
              <tr>
                <th scope="row">Role:</th>
                <td class="value">{{ user?.role ?? 'Loading…' }}</td>
              </tr>
            </tbody>
          </table>
        }
      }
      <button type="button" class="logout-all" (click)="askLogoutAll()">Logout all sessions</button>
    </section>

    @if (confirming()) {
      <div class="backdrop" (click)="onBackdropClick($event)">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="logout-all-title">
          <h2 id="logout-all-title">Logout all sessions?</h2>
          <p>You will be signed out on every device, this one included.</p>
          @if (logoutAllError(); as message) {
            <p class="alert alert--error" role="alert">{{ message }}</p>
          }
          <div class="actions">
            <button #cancelButton type="button" (click)="cancelLogoutAll()" [disabled]="loggingOutAll()">Cancel</button>
            <button type="button" class="danger" (click)="logoutAll()" [disabled]="loggingOutAll()">
              {{ loggingOutAll() ? 'Signing out…' : 'Yes' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .bar {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 1rem;
      }
      .back {
        justify-self: start;
      }
      .sign-out {
        justify-self: end;
      }
      h1 {
        margin: 1rem 0;
        text-align: center;
      }
      .card {
        background: #fff;
        border-radius: 8px;
        padding: 1.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      }
      .details {
        border-collapse: collapse;
      }
      .details th,
      .details td {
        border: none;
        padding: 0.25rem 1rem 0.25rem 0;
        text-align: left;
        vertical-align: top;
      }
      .details th {
        font-weight: 600;
        color: #52606d;
        white-space: nowrap;
      }
      /* The longest email (254 characters) has no place to break otherwise. */
      .value {
        overflow-wrap: anywhere;
      }
      .logout-all {
        margin-top: 1.5rem;
      }
      button {
        font: inherit;
        padding: 0.5rem 1.25rem;
      }
      .alert {
        margin: 0;
        padding: 0.625rem 0.75rem;
        border-radius: 6px;
      }
      .alert--error {
        background: #fff5f5;
        color: #c92a2a;
      }
      .backdrop {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgba(31, 41, 51, 0.45);
      }
      .dialog {
        display: grid;
        gap: 1rem;
        max-width: 26rem;
        background: #fff;
        border-radius: 8px;
        padding: 1.25rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      }
      .dialog h2,
      .dialog p {
        margin: 0;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      .danger {
        background: #c92a2a;
        border: 1px solid #c92a2a;
        border-radius: 4px;
        color: #fff;
      }
    `,
  ],
})
export class UserProfilePageComponent {
  protected readonly currentUser = inject(CurrentUserService);
  private readonly refresher = inject(RefreshTokenService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  readonly confirming = signal(false);
  readonly loggingOutAll = signal(false);
  readonly logoutAllError = signal<string | null>(null);

  /** Back to the page this one was opened from, or to the root when it was opened directly. */
  back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/');
    }
  }

  signOut(): void {
    void this.refresher.logout();
    void this.router.navigateByUrl('/login');
  }

  askLogoutAll(): void {
    this.logoutAllError.set(null);
    this.confirming.set(true);
    // The safe answer gets the focus, so that Enter does not end every session by mistake.
    afterNextRender(() => this.cancelButton()?.nativeElement.focus(), { injector: this.injector });
  }

  cancelLogoutAll(): void {
    if (!this.loggingOutAll()) {
      this.confirming.set(false);
    }
  }

  /** A click on the dimmed page around the dialog, not inside it. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelLogoutAll();
    }
  }

  async logoutAll(): Promise<void> {
    if (this.loggingOutAll()) {
      return;
    }
    this.logoutAllError.set(null);
    this.loggingOutAll.set(true);
    const result = await this.refresher.logoutAll();
    this.loggingOutAll.set(false);
    if (result.ok) {
      this.confirming.set(false);
      void this.router.navigateByUrl('/login');
      return;
    }
    this.logoutAllError.set(failureMessage(result.failure));
  }
}
