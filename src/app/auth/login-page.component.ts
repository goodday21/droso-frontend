import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthApiService } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from './auth.model';
import { fieldMessages, showFailure } from './form-errors';

/**
 * Signs a user in, keeps the access token and sends them to the root page.
 *
 * After a registration the page is opened with `?registered=1` and the email in the navigation
 * state. The email is not put into the URL; the browser keeps the state in the history of the tab,
 * so a reload restores the email, while the same URL opened in a new tab comes without it.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './auth-form.css',
  template: `
    <h1>Sign in</h1>
    <section class="card">
      <form [formGroup]="form" (ngSubmit)="submit()">
        @if (registered) {
          <p class="alert alert--success" role="status">Registration complete. Please sign in.</p>
        }
        @if (formError(); as message) {
          <p class="alert alert--error" role="alert">{{ message }}</p>
        }

        @let emailErrors = messages('email');
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email"
                 [class.invalid]="emailErrors.length > 0" />
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
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password"
                 [class.invalid]="passwordErrors.length > 0" />
          @if (passwordErrors.length > 0) {
            <ul class="errors" data-field="password">
              @for (message of passwordErrors; track message) {
                <li>{{ message }}</li>
              }
            </ul>
          }
        </div>

        <button type="submit" [disabled]="submitting()">
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="switch">No account? <a routerLink="/register">Sign up</a></p>
    </section>
  `,
})
export class LoginPageComponent {
  private readonly api = inject(AuthApiService);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);

  readonly registered = inject(ActivatedRoute).snapshot.queryParamMap.has('registered');

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
