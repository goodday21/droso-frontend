import { BrowserContext, Route } from '@playwright/test';

export type AuthEndpoint = 'register' | 'login';

/** How a mocked endpoint answers. */
export type MockResponse =
  | { status: number; json: unknown }
  /** A body that is not an `ApiError`, such as the error page of the dev server proxy. */
  | { status: number; html: string }
  /** No response at all, as with a network error. */
  | { abort: true };

const HEALTH_UP = {
  status: 'UP',
  database: { status: 'UP', latencyMs: 1 },
  timestamp: '2026-10-28T10:00:00Z',
};

/**
 * Answers the calls of the API in the browser, so that the tests need no backend.
 *
 * The health endpoint, called by the root page, is always UP. The authentication endpoints answer
 * what the test sets with {@link respond} or {@link hold}; a call that the test did not expect is
 * recorded and fails the test (see `fixtures.ts`). Every body sent is kept for the assertions.
 */
export class AuthApiMock {
  private readonly responses = new Map<AuthEndpoint, { response: MockResponse; gate?: Promise<void> }>();
  private readonly bodies: Record<AuthEndpoint, unknown[]> = { register: [], login: [] };
  readonly unexpected: AuthEndpoint[] = [];

  private constructor() {}

  /** Routes the context rather than a page, so that the tabs a test opens are mocked as well. */
  static async install(context: BrowserContext): Promise<AuthApiMock> {
    const mock = new AuthApiMock();
    await context.route('**/api/v1/health', (route) => route.fulfill({ json: HEALTH_UP }));
    for (const endpoint of ['register', 'login'] as const) {
      await context.route(`**/api/v1/auth/${endpoint}`, (route) => mock.handle(endpoint, route));
    }
    return mock;
  }

  /** Answers every later call of the endpoint with the response. */
  respond(endpoint: AuthEndpoint, response: MockResponse): void {
    this.responses.set(endpoint, { response });
  }

  /**
   * Like {@link respond}, but keeps the calls pending until the returned function is called, so
   * that the test can look at the page while the request is in flight.
   */
  hold(endpoint: AuthEndpoint, response: MockResponse): () => void {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.responses.set(endpoint, { response, gate });
    return release;
  }

  /** The bodies sent to the endpoint so far, parsed. */
  requests(endpoint: AuthEndpoint): unknown[] {
    return this.bodies[endpoint];
  }

  private async handle(endpoint: AuthEndpoint, route: Route): Promise<void> {
    this.bodies[endpoint].push(route.request().postDataJSON());
    const entry = this.responses.get(endpoint);
    if (!entry) {
      this.unexpected.push(endpoint);
      await route.abort('failed');
      return;
    }
    await entry.gate;
    const { response } = entry;
    if ('abort' in response) {
      await route.abort('failed');
    } else if ('html' in response) {
      await route.fulfill({ status: response.status, contentType: 'text/html', body: response.html });
    } else {
      await route.fulfill({ status: response.status, json: response.json });
    }
  }
}
