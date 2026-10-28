import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiFailure, failureMessage } from '../api/api-error';

/**
 * Puts the `fieldErrors` of an `ApiError` on the controls of the form, as the error `server`.
 *
 * The error goes away by itself when the user edits the field: a change of the value runs the
 * validators again, which replace the errors set here.
 *
 * Returns the errors of the fields that the form does not have, so that the page can show them
 * instead of dropping them silently.
 */
export function applyServerErrors(form: FormGroup, fieldErrors: Record<string, string>): string[] {
  const unbound: string[] = [];
  for (const [field, message] of Object.entries(fieldErrors)) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
    } else {
      unbound.push(`${field} ${message}`);
    }
  }
  return unbound;
}

/**
 * Shows a failure of the API on the form.
 *
 * The `fieldErrors` go under their fields; the returned message is the one to show above the
 * form, or `null` when the failure is entirely shown under the fields (a plain validation error).
 */
export function showFailure(
  form: FormGroup,
  failure: ApiFailure,
  messages: Record<string, string> = {},
): string | null {
  if (failure.kind !== 'api') {
    return failureMessage(failure);
  }
  const { fieldErrors } = failure.error;
  const unbound = applyServerErrors(form, fieldErrors);
  const bound = Object.keys(fieldErrors).length - unbound.length;
  if (bound > 0 && unbound.length === 0) {
    return null;
  }
  return [failureMessage(failure, messages), ...unbound].join(' ');
}

/**
 * The messages to show under a field: those of its own validators once it was touched, and those
 * of the server, which joins several errors of one field with `; `.
 */
export function fieldMessages(control: AbstractControl): string[] {
  const errors = control.errors;
  if (!errors || !control.touched) {
    return [];
  }
  const messages: string[] = [];
  if (errors['required']) {
    messages.push('is required');
  }
  if (errors['maxlength']) {
    messages.push(`must be at most ${errors['maxlength'].requiredLength} characters`);
  }
  if (typeof errors['server'] === 'string') {
    messages.push(...errors['server'].split('; '));
  }
  return messages;
}
