import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TuiAutoFocus } from '@taiga-ui/cdk';
import { TuiButton, TuiDialog, TuiDialogOptions, TuiNotification } from '@taiga-ui/core';
import { map } from 'rxjs';
import { failureMessage } from '../api/api-error';
import { CurrentUserService } from '../auth/current-user.service';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { PageBarComponent } from '../layout/page-bar.component';
import { RoleBadgeComponent } from '../layout/role-badge.component';

/**
 * The account of the signed-in user: the email and the role, the badge of its colour
 * ({@link RoleBadgeComponent}), and the sign-out of every session.
 *
 * Below the header of the application, with its tab, the page has a bar of its own: Back and its
 * title ({@link PageBarComponent}). Only a signed-in user opens it (`authGuard`).
 *
 * *Logout all sessions* asks first, in a dialog of Taiga UI (`tuiDialog`), which is shown in the
 * root `tui-root` over the dimmed page, with the focus on Cancel, so that Enter does not end every
 * session by mistake. The dialog closes on Cancel, on Escape, on a click outside it (`dismissible`
 * of Taiga UI), or once the backend has accepted Yes; while the call is pending it stays.
 */
@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageBarComponent, RoleBadgeComponent, TuiAutoFocus, TuiButton, TuiDialog, TuiNotification],
  template: `
    <app-page-bar title="User profile" />

    <section class="card">
      @switch (currentUser.state().status) {
        @case ('failed') {
          <div tuiNotification appearance="negative" size="m" role="alert">Could not load the profile.</div>
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
                <td class="value">
                  @if (user) {
                    <app-role-badge [role]="user.role" />
                  } @else {
                    Loading…
                  }
                </td>
              </tr>
            </tbody>
          </table>
        }
      }
      <button
        tuiButton
        type="button"
        appearance="secondary-destructive"
        size="m"
        iconStart="@tui.log-out"
        class="logout-all"
        (click)="askLogoutAll()"
      >
        Logout all sessions
      </button>
    </section>

    <ng-template [tuiDialog]="confirming()" [tuiDialogOptions]="dialogOptions" (tuiDialogChange)="onDialogChange($event)">
      <div class="dialog">
        <p>You will be signed out on every device, this one included.</p>
        @if (logoutAllError(); as message) {
          <div tuiNotification appearance="negative" size="s" role="alert">{{ message }}</div>
        }
        <footer>
          <button tuiButton tuiAutoFocus type="button" appearance="secondary" size="m" (click)="cancelLogoutAll()" [disabled]="loggingOutAll()">
            Cancel
          </button>
          <button tuiButton type="button" appearance="primary-destructive" size="m" (click)="logoutAll()" [disabled]="loggingOutAll()">
            {{ loggingOutAll() ? 'Signing out…' : 'Yes' }}
          </button>
        </footer>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .card {
        display: grid;
        justify-items: start;
        gap: 1.5rem;
        padding: 1.5rem;
        background: var(--tui-background-base);
        border-radius: var(--tui-radius-l);
        box-shadow: 0 0.25rem 1.5rem rgba(0, 0, 0, 0.06);
      }
      .details {
        border-collapse: collapse;
        font: var(--tui-typography-body-m);
      }
      .details th,
      .details td {
        border: none;
        padding: 0.375rem 1.5rem 0.375rem 0;
        text-align: left;
        vertical-align: middle;
      }
      .details th {
        font-weight: normal;
        color: var(--tui-text-secondary);
        white-space: nowrap;
      }
      /* The longest email (254 characters) has no place to break otherwise. */
      .value {
        overflow-wrap: anywhere;
        color: var(--tui-text-primary);
      }
      .dialog {
        display: grid;
        gap: 1rem;
      }
      .dialog p {
        margin: 0;
      }
      .dialog footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class UserProfilePageComponent {
  protected readonly currentUser = inject(CurrentUserService);
  private readonly refresher = inject(RefreshTokenService);
  private readonly router = inject(Router);

  readonly confirming = signal(false);
  readonly loggingOutAll = signal(false);
  readonly logoutAllError = signal<string | null>(null);

  /** Escape and a click outside close the dialog, except while the call is pending. */
  protected readonly dialogOptions: Partial<TuiDialogOptions<void>> = {
    label: 'Logout all sessions?',
    size: 's',
    closable: false,
    dismissible: toObservable(this.loggingOutAll).pipe(map((pending) => !pending)),
  };

  askLogoutAll(): void {
    this.logoutAllError.set(null);
    this.confirming.set(true);
  }

  cancelLogoutAll(): void {
    if (!this.loggingOutAll()) {
      this.confirming.set(false);
    }
  }

  /** The dialog was closed by Taiga UI itself: on Escape or a click outside it. */
  protected onDialogChange(open: boolean): void {
    this.confirming.set(open);
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
