import { BrowserContext, Route } from '@playwright/test';

/**
 * A call of the API: the method and the path after `/api/v1`, e.g. `'POST /auth/login'`. A segment
 * written `:name` matches any value, e.g. `'GET /defects/:id'`.
 */
export type Endpoint = `${'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'} /${string}`;

/** How a mocked endpoint answers. */
export interface MockResponse {
  status: number;
  json: unknown;
}

interface Entry {
  response: MockResponse;
  gate?: Promise<void>;
}

const API_PREFIX = '/api/v1';

const HEALTH_UP: MockResponse = {
  status: 200,
  json: { status: 'UP', database: { status: 'UP', latencyMs: 1 }, timestamp: '2026-10-28T10:00:00Z' },
};

/**
 * Answers the calls of the API in the browser, so that the tests need no backend.
 *
 * One route catches every call of the API. The health endpoint, called by the root page, is UP
 * unless the test sets it; every other endpoint answers what the test sets with {@link respond} or
 * {@link hold}. A call that the test did not expect is recorded and fails the test (see
 * `fixtures.ts`). Every body sent is kept for the assertions.
 */
export class ApiMock {
  private readonly responses = new Map<Endpoint, Entry>([['GET /health', { response: HEALTH_UP }]]);
  private readonly bodies = new Map<Endpoint, unknown[]>();
  readonly unexpected: string[] = [];

  private constructor() {}

  /** Routes the context rather than a page, so that the tabs a test opens are mocked as well. */
  static async install(context: BrowserContext): Promise<ApiMock> {
    const mock = new ApiMock();
    await context.route(`**${API_PREFIX}/**`, (route) => mock.handle(route));
    return mock;
  }

  /** Answers every later call of the endpoint with the response. */
  respond(endpoint: Endpoint, response: MockResponse): void {
    this.responses.set(endpoint, { response });
  }

  /**
   * Like {@link respond}, but keeps the calls pending until the returned function is called, so
   * that the test can look at the page while the request is in flight.
   */
  hold(endpoint: Endpoint, response: MockResponse): () => void {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.responses.set(endpoint, { response, gate });
    return release;
  }

  /** The bodies sent to the endpoint so far, parsed; `null` for a call without a body. */
  requests(endpoint: Endpoint): unknown[] {
    return this.bodies.get(endpoint) ?? [];
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice(API_PREFIX.length);
    const call = `${request.method()} ${path}`;
    const endpoint = [...this.responses.keys()].find((candidate) => matches(candidate, call));
    if (!endpoint) {
      this.unexpected.push(call);
      await route.abort('failed');
      return;
    }
    const bodies = this.bodies.get(endpoint) ?? [];
    bodies.push(request.postDataJSON());
    this.bodies.set(endpoint, bodies);
    const { response, gate } = this.responses.get(endpoint)!;
    await gate;
    await route.fulfill({ status: response.status, json: response.json });
  }
}

function matches(endpoint: Endpoint, call: string): boolean {
  const expected = endpoint.split('/');
  const actual = call.split('/');
  return (
    expected.length === actual.length &&
    expected.every((segment, index) => segment.startsWith(':') || segment === actual[index])
  );
}
