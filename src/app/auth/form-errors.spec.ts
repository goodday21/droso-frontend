import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ApiFailure } from '../api/api-error';
import { applyServerErrors, fieldMessages, showFailure } from './form-errors';

describe('form errors', () => {
  let form: FormGroup<{ email: FormControl<string>; password: FormControl<string> }>;

  beforeEach(() => {
    form = new FormGroup({
      email: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4)] }),
    });
  });

  const apiFailure = (code: string, fieldErrors: Record<string, string> = {}): ApiFailure => ({
    kind: 'api',
    error: { status: 400, code, message: `message of ${code}`, fieldErrors },
  });

  describe('applyServerErrors', () => {
    it('puts the error on the field and shows it at once', () => {
      applyServerErrors(form, { password: 'must contain a digit' });

      expect(form.controls.password.errors).toEqual({ server: 'must contain a digit' });
      expect(form.controls.password.touched).toBeTrue();
    });

    it('keeps the errors that the field already has', () => {
      applyServerErrors(form, { email: 'must be a valid email address' });

      expect(form.controls.email.errors).toEqual({ required: true, server: 'must be a valid email address' });
    });

    it('returns the errors of the fields that the form does not have', () => {
      expect(applyServerErrors(form, { email: 'is taken', role: 'is not allowed' })).toEqual(['role is not allowed']);
    });
  });

  describe('showFailure', () => {
    it('shows nothing above the form when every error is under its field', () => {
      expect(showFailure(form, apiFailure('VALIDATION_ERROR', { password: 'must contain a digit' }))).toBeNull();
    });

    it('adds the errors of the unknown fields to the message', () => {
      const failure = apiFailure('VALIDATION_ERROR', { email: 'is taken', role: 'is not allowed' });

      expect(showFailure(form, failure)).toBe('message of VALIDATION_ERROR role is not allowed');
      expect(form.controls.email.errors?.['server']).toBe('is taken');
    });

    it('shows the message of the page for a failure without field errors', () => {
      const failure = apiFailure('REGISTRATION_DISABLED');

      expect(showFailure(form, failure, { REGISTRATION_DISABLED: 'Closed.' })).toBe('Closed.');
    });

    it('shows a general message for a failure that is not an ApiError', () => {
      expect(showFailure(form, { kind: 'unreachable' })).toContain('not reachable');
      expect(showFailure(form, { kind: 'unexpected', status: 504 })).toContain('try again later');
      expect(form.controls.email.errors).toEqual({ required: true });
    });
  });

  describe('fieldMessages', () => {
    it('shows nothing for a field that was not touched', () => {
      expect(fieldMessages(form.controls.email)).toEqual([]);
    });

    it('names the violated validators', () => {
      form.controls.password.setValue('12345');
      form.markAllAsTouched();

      expect(fieldMessages(form.controls.email)).toEqual(['is required']);
      expect(fieldMessages(form.controls.password)).toEqual(['must be at most 4 characters']);
    });

    it('splits several errors of the server into one message each', () => {
      applyServerErrors(form, { password: 'must contain a digit; must contain an upper case letter' });

      expect(fieldMessages(form.controls.password)).toEqual(['must contain a digit', 'must contain an upper case letter']);
    });
  });
});
