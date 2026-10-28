import { HttpErrorResponse } from '@angular/common/http';

/**
 * Body of every error of the backend API (except the 503 of the health endpoint).
 *
 * `code` and `message` are stable, `message` is fixed per code. `fieldErrors` is always present,
 * empty unless the request failed validation; several errors of one field are joined with `; `.
 */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
}

/**
 * Why a call to the API failed, as seen by the UI.
 *
 * - `api`:         the backend answered with an {@link ApiError}.
 * - `unreachable`: no response at all (network error).
 * - `unexpected`:  a response that is not an {@link ApiError}, e.g. the default error page of the
 *                  servlet container, or the error of the dev server proxy when the backend is down.
 */
export type ApiFailure =
  | { kind: 'api'; error: ApiError }
  | { kind: 'unreachable' }
  | { kind: 'unexpected'; status: number };

/** Result of a call to the API: either the body of the successful response, or a failure. */
export type ApiResult<T> = { ok: true; body: T } | { ok: false; failure: ApiFailure };

/**
 * Maps an error of `HttpClient` to an {@link ApiFailure}.
 *
 * The shape of the body decides, not the status: a 5xx may come from the dev server proxy rather
 * than from the backend, and must not be read as an `ApiError`.
 */
export function toApiFailure(response: HttpErrorResponse): ApiFailure {
  if (response.status === 0) {
    return { kind: 'unreachable' };
  }
  if (isApiError(response.error)) {
    return { kind: 'api', error: response.error };
  }
  return { kind: 'unexpected', status: response.status };
}

function isApiError(body: unknown): body is ApiError {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const candidate = body as Partial<ApiError>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.fieldErrors === 'object' &&
    candidate.fieldErrors !== null &&
    Object.values(candidate.fieldErrors).every((value) => typeof value === 'string')
  );
}

/**
 * The message to show for a failure that is not bound to a field.
 *
 * Known codes get their text from `messages`; any other code falls back to the `message` of the
 * backend, which is stable and never contains the text of an exception.
 */
export function failureMessage(failure: ApiFailure, messages: Record<string, string> = {}): string {
  switch (failure.kind) {
    case 'unreachable':
      return 'The service is not reachable. Check your connection and try again.';
    case 'unexpected':
      return 'Something went wrong. Please try again later.';
    case 'api': {
      const { code, message } = failure.error;
      if (code in messages) {
        return messages[code];
      }
      if (code === 'INTERNAL_ERROR') {
        return 'Something went wrong. Please try again later.';
      }
      return message;
    }
  }
}
