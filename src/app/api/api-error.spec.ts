import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, failureMessage, toApiFailure } from './api-error';

describe('toApiFailure', () => {
  const conflict: ApiError = {
    status: 409,
    code: 'EMAIL_ALREADY_REGISTERED',
    message: 'The email is already registered',
    fieldErrors: { email: 'is already registered' },
  };

  it('reads an ApiError body as an "api" failure', () => {
    const failure = toApiFailure(new HttpErrorResponse({ status: 409, error: conflict }));

    expect(failure).toEqual({ kind: 'api', error: conflict });
  });

  it('maps status 0 to "unreachable"', () => {
    const failure = toApiFailure(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));

    expect(failure).toEqual({ kind: 'unreachable' });
  });

  it('maps a body that is not an ApiError to "unexpected", whatever the status', () => {
    // The error page of the servlet container, and the answer of the dev server proxy.
    for (const error of ['<html>Bad Request</html>', null, { error: 'Bad Request', status: 400 }]) {
      expect(toApiFailure(new HttpErrorResponse({ status: 500, error }))).toEqual({
        kind: 'unexpected',
        status: 500,
      });
    }
  });
});

describe('failureMessage', () => {
  const apiFailure = (code: string, message: string) =>
    ({ kind: 'api', error: { status: 400, code, message, fieldErrors: {} } }) as const;

  it('prefers the text of the page for a known code', () => {
    const failure = apiFailure('REGISTRATION_DISABLED', 'Registration is disabled');

    expect(failureMessage(failure, { REGISTRATION_DISABLED: 'Closed.' })).toBe('Closed.');
  });

  it('falls back to the message of the backend for another code', () => {
    expect(failureMessage(apiFailure('MALFORMED_REQUEST', 'Malformed request'))).toBe('Malformed request');
  });

  it('does not show the message of an internal error', () => {
    expect(failureMessage(apiFailure('INTERNAL_ERROR', 'Internal error'))).toContain('try again later');
  });

  it('tells that the service is not reachable', () => {
    expect(failureMessage({ kind: 'unreachable' })).toContain('not reachable');
  });
});
