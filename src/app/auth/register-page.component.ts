import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from './auth-api.service';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from './auth.model';
import { fieldMessages, showFailure } from './form-errors';

const MESSAGES: Record<string, string> = {
  REGISTRATION_DISABLED: 'Registration is currently disabled.',
};

/**
 * Registers a user and, on success, sends them to the sign-in page.
 *
 * The form checks only that the fields are filled and not too long. The rules of the email and of
 * the password belong to the backend, which reports every violated rule in `fieldErrors`: a copy
 * of them here would sooner or later differ.
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './auth-form.css',
  template: `
    <h1>Sign up</h1>
    <section class="card">
      <form [formGroup]="form" (ngSubmit)="submit()">
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
          @if (emailTaken() && form.controls.email.hasError('server')) {
            <p class="hint"><a routerLink="/login">Sign in instead</a></p>
          }
        </div>

        @let passwordErrors = messages('password');
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="new-password"
                 [class.invalid]="passwordErrors.length > 0" />
          <p class="hint">
            8 to 64 characters: Latin letters, digits and punctuation, no spaces; at least one upper
            case letter, one lower case letter, one digit and one punctuation character.
          </p>
          @if (passwordErrors.length > 0) {
            <ul class="errors" data-field="password">
              @for (message of passwordErrors; track message) {
                <li>{{ message }}</li>
              }
            </ul>
          }
        </div>

        <button type="submit" [disabled]="submitting() || registrationDisabled()">
          {{ submitting() ? 'Signing up…' : 'Sign up' }}
        </button>
      </form>
      <p class="switch">Already registered? <a routerLink="/login">Sign in</a></p>
    </section>
  `,
})
export class RegisterPageComponent {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.maxLength(EMAIL_MAX_LENGTH)]],
    password: ['', [Validators.required, Validators.maxLength(PASSWORD_MAX_LENGTH)]],
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly emailTaken = signal(false);
  readonly registrationDisabled = signal(false);

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
    this.emailTaken.set(false);
    this.submitting.set(true);

    // Sent as typed: the backend normalizes the email and never changes the password.
    this.api.register(this.form.getRawValue()).subscribe((result) => {
      this.submitting.set(false);
      if (result.ok) {
        void this.router.navigate(['/login'], {
          queryParams: { registered: 1 },
          state: { email: result.body.email },
        });
        return;
      }
      const failure = result.failure;
      if (failure.kind === 'api') {
        this.emailTaken.set(failure.error.code === 'EMAIL_ALREADY_REGISTERED');
        this.registrationDisabled.set(failure.error.code === 'REGISTRATION_DISABLED');
      }
      this.formError.set(showFailure(this.form, failure, MESSAGES));
    });
  }
}
