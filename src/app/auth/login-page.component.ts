import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiIcon, TuiInput, TuiLink, TuiNotification } from '@taiga-ui/core';
import { TuiPassword } from '@taiga-ui/kit';
import { PageBarComponent } from '../layout/page-bar.component';
import { AuthApiService } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from './auth.model';
import { fieldMessages, showFailure } from './form-errors';

/**
 * Signs a user in, keeps the access token and sends them to the root page. The refresh token comes
 * with the answer as an `HttpOnly` cookie, which the browser keeps by itself.
 *
 * After a registration the page is opened with `?registered=1` and the email in the navigation
 * state. The email is not put into the URL; the browser keeps the state in the history of the tab,
 * so a reload restores the email, while the same URL opened in a new tab comes without it.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageBarComponent,
    TuiButton,
    TuiIcon,
    TuiInput,
    TuiLink,
    TuiNotification,
    TuiPassword,
  ],
  styleUrl: './auth-form.css',
  template: `
    <app-page-bar title="Sign in" [back]="false" />
    <section class="card">
      <form [formGroup]="form" (ngSubmit)="submit()">
        @if (registered) {
          <div tuiNotification appearance="positive" size="s" role="status">Registration complete. Please sign in.</div>
        }
        @if (expired) {
          <div tuiNotification appearance="warning" size="s" role="status">Your session has ended. Please sign in again.</div>
        }
        @if (formError(); as message) {
          <div tuiNotification appearance="negative" size="s" role="alert">{{ message }}</div>
        }

        @let emailErrors = messages('email');
        <div class="field">
          <tui-textfield [tuiTextfieldCleaner]="false" [invalid]="emailErrors.length > 0">
            <label tuiLabel for="email">Email</label>
            <input tuiInput id="email" type="email" formControlName="email" autocomplete="email" />
          </tui-textfield>
          @if (emailErrors.length > 0) {
            <ul class="errors" data-field="email">
              @for (message of emailErrors; track message) {
                <li>{{ message }}</li>
              }
            </ul>
          }
        </div>

        @let passwordErrors = messages('password');
        <div class="field">
          <tui-textfield [tuiTextfieldCleaner]="false" [invalid]="passwordErrors.length > 0">
            <label tuiLabel for="password">Password</label>
            <input tuiInput id="password" type="password" formControlName="password" autocomplete="current-password" />
            <tui-icon tuiPassword />
          </tui-textfield>
          @if (passwordErrors.length > 0) {
            <ul class="errors" data-field="password">
              @for (message of passwordErrors; track message) {
                <li>{{ message }}</li>
              }
            </ul>
          }
        </div>

        <button tuiButton type="submit" size="m" [disabled]="submitting()">
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="switch">No account? <a tuiLink routerLink="/register">Sign up</a></p>
    </section>
  `,
})
export class LoginPageComponent {
  private readonly api = inject(AuthApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  readonly registered = this.query.has('registered');
  /** Opened with `?expired=1` when the backend no longer accepts the session (`authInterceptor`). */
  readonly expired = this.query.has('expired');

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.maxLength(EMAIL_MAX_LENGTH)]],
    password: ['', [Validators.required, Validators.maxLength(PASSWORD_MAX_LENGTH)]],
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    // The component is created while the navigation that opened it is still current.
    const email = this.router.currentNavigation()?.extras.state?.['email'];
    if (typeof email === 'string') {
      this.form.controls.email.setValue(email);
    }
  }

  messages(field: 'email' | 'password'): string[] {
    return fieldMessages(this.form.controls[field]);
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.formError.set(null);
    this.submitting.set(true);

    this.api.login(this.form.getRawValue()).subscribe((result) => {
      this.submitting.set(false);
      if (result.ok) {
        this.session.save(result.body.accessToken, result.body.expiresIn);
        void this.router.navigateByUrl('/');
        return;
      }
      const failure = result.failure;
      if (failure.kind === 'api' && failure.error.code === 'INVALID_CREDENTIALS') {
        // The backend does not tell which of the two is wrong, and neither does the page.
        this.formError.set('Invalid email or password.');
        this.form.controls.password.reset();
        return;
      }
      this.formError.set(showFailure(this.form, failure));
    });
  }
}
