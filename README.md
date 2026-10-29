# droso-frontend

Angular 22 application that shows the health of the service and of its PostgreSQL dependency, and
lets a user sign up and sign in.

It talks to the backend, [droso-backend](https://github.com/goodday21/droso-backend), through
`GET /api/v1/health`, `POST /api/v1/auth/register` and `POST /api/v1/auth/login`; the
[API contract](https://github.com/goodday21/droso-backend/blob/main/backend/README.md#api-contract)
is described there, and `src/app/health/health.model.ts`, `src/app/auth/auth.model.ts` and
`src/app/api/api-error.ts` follow it.

For local development, clone both repositories next to each other:

```
IdeaProjects/
├── droso-backend/
└── droso-frontend/
```

## Running

```bash
npm install
npm start                  # dev server on http://localhost:4200, proxies /api to :8080
npm test                   # unit tests (ChromeHeadless)
npm run e2e                # browser tests, no backend needed — see Browser tests
npm run e2e:integration    # browser tests against the running backend
npm run build
```

The dev server forwards every `/api` request to the backend on `http://localhost:8080`
(`proxy.conf.json`), so the backend has to run as well — see [Manual walkthrough](#manual-walkthrough).

## Pages

| Path        | Page                                                                    |
|-------------|-------------------------------------------------------------------------|
| `/`         | Service health; public, the health endpoint needs no token              |
| `/register` | Sign up; on success it opens `/login?registered=1` with the email filled |
| `/login`    | Sign in; on success it keeps the token and opens `/`                    |

Any other path shows *Page not found*.

The access token is kept in `localStorage` (`AuthSessionService`): every tab shares one session, a
tab opened later is signed in as well, and a sign-in or a sign-out in one tab reaches the others at
once (`storage` event). The token is not cleared when the browser closes — no page can tell that
reliably — and is dropped after `expiresIn` seconds (30 minutes). There is no refresh token yet,
and no request sends the token so far; *Sign out* in the header forgets it.

## Errors of the API

`toApiFailure` (`src/app/api/api-error.ts`) maps a failed call to one of three outcomes:

* `api` — the body is an `ApiError` (`{status, code, message, fieldErrors}`);
* `unreachable` — no response at all (status 0);
* `unexpected` — a response that is not an `ApiError`, whatever its status. With the dev server, a
  stopped backend gives a 5xx of the proxy, not status 0, so the status alone does not decide.

The forms check only that the fields are filled and not longer than the backend accepts. The rules
of the email and of the password belong to the backend: its `fieldErrors` are shown under the
fields (several errors of one field are split on `; `) and disappear when the field is edited. An
error of a field that the form does not have, and any failure without `fieldErrors`, is shown
above the form:

| Answer                          | Shown as                                                    |
|---------------------------------|-------------------------------------------------------------|
| 400 `VALIDATION_ERROR`          | The messages under the fields                               |
| 409 `EMAIL_ALREADY_REGISTERED`  | *is already registered* under the email, with *Sign in instead* |
| 403 `REGISTRATION_DISABLED`     | *Registration is currently disabled*; the button is disabled |
| 401 `INVALID_CREDENTIALS`       | *Invalid email or password*, bound to no field; the password is cleared |
| 500 `INTERNAL_ERROR`, `unexpected` | *Something went wrong. Please try again later.*          |
| `unreachable`                   | *The service is not reachable*                              |
| any other code                  | The `message` of the backend, which is fixed per code       |

`HealthApiService` maps the HTTP status to three explicit outcomes:

* `up` — HTTP 200, the database is reachable;
* `down` — HTTP 503, the database is not reachable (a normal answer, not a transport error);
* `unreachable` — the backend itself could not be reached (network error).

## Tests

```bash
npm install                  # once
npm test                     # single run, ChromeHeadless
npm test -- --watch          # watch mode: re-runs on every file change
```

In watch mode Karma serves a UI at <http://localhost:9876/> — open it, tick the spec files you
want to see, and use the "Debug" button to inspect the DOM of a failing expectation.

To run a single spec, narrow the pattern, e.g. `ng test --watch --include='**/health-api.service.spec.ts'`.

## Browser tests

Playwright drives the sign-up and sign-in pages in Chromium (`e2e/`, `playwright.config.ts`):

```bash
npx playwright install chromium   # once, and after an update of @playwright/test
npm run e2e                       # headless; starts the dev server, or uses a running `npm start`
npm run e2e:ui                    # the UI mode of Playwright: pick tests, watch them, inspect the DOM
npx playwright show-report        # the HTML report of the last run
```

The tests of `e2e/mocked/` need no backend: `e2e/support/auth-api.ts` answers every call of the
API in the browser, so they also cover the answers a running backend rarely gives — a disabled
registration, an internal error, a stopped backend behind the proxy, no network. Each test sets
the answers it expects; a call it did not mock fails it.

* `e2e/pages/` — page objects of the two forms and of the header;
* `e2e/support/responses.ts` — the answers of the backend, following its API contract;
* `e2e/support/session.ts` — reading and seeding the session in `localStorage`.

To run one file or one test: `npm run e2e -- e2e/mocked/login.spec.ts` or `npm run e2e -- -g "pending"`.

### Against the real backend

The tests of `e2e/integration/` go through the proxy of the dev server to the backend, so start it
first, as in [Manual walkthrough](#manual-walkthrough) (`./gradlew bootRunWithPostgres` with
`DROSO_JWT_SECRET` set):

```bash
npm run e2e:integration
```

They check what the mocked tests cannot: that the pages and the real API agree — a sign-up and a
sign-in end to end, the password rules of the backend, a taken email, a wrong password. Every test
registers its own `e2e-<time>-<random>@example.com`, so the database needs no cleaning, and its
users simply pile up. Before the tests, the project `integration-setup` checks
`GET /api/v1/health` and stops the run with a hint when the backend does not answer.

### On CI

After *Unit tests and build*, two jobs run in parallel:

* *Browser tests (mocked API)* — `npm run e2e`; on a failure the HTML report with the traces of the
  failed tests is attached to the run as `playwright-report`.
* *Browser tests (real backend)* — checks out `main` of `goodday21/droso-backend`, starts it with
  `./gradlew bootRunWithPostgres` (embedded PostgreSQL, a new `DROSO_JWT_SECRET` on every run),
  waits for its health, then runs `npm run e2e:integration`. On a failure the report and the log of
  the backend are attached as `playwright-report-integration`.

The backend repository is private: the job checks it out with a read-only deploy key of it, kept in
the secret `BACKEND_DEPLOY_KEY` of this repository. Pull requests from forks get no secrets, so
this job fails for them.

Both jobs set up Node and Playwright with the local action `.github/actions/setup-playwright`.

## Manual walkthrough

Two terminals:

```bash
# 1) a real PostgreSQL on :5432 (no Docker needed) and the backend on :8080
cd droso-backend/backend && ./gradlew bootRunWithPostgres

# 2) the dev server on :4200
cd droso-frontend && npm start
```

`./gradlew runPostgres` and `./gradlew bootRun` in two separate terminals (both in `droso-backend/backend/`) do
the same as step 1.

Open <http://localhost:4200/>. The panel shows a green **UP** badge with the database latency.

Now break the database and press **Refresh** in the panel:

```bash
# stops PostgreSQL — the panel must turn red with HTTP status 503
taskkill /IM postgres.exe /F
```

Restart it with `./gradlew runPostgres` in `droso-backend/backend/` in another terminal and press **Refresh**
again — the panel must return to green.
This proves the UI reacts to a genuinely broken database rather than to a static mock.

To see the third state, stop the backend (`Ctrl+C` in terminal 1) and press **Refresh**: the panel
shows *not reachable* instead of *DOWN*, because the service itself no longer answers.

### Signing up and in

The backend needs `DROSO_JWT_SECRET` (see its README). With both running, open
<http://localhost:4200/register>:

1. Register `qwe@gmail.com` with `secret`: every violated rule of the password is listed under it.
2. Register with `Sup3r-Secret!`: the sign-in page opens with *Registration complete* and the email.
3. Go back to `/register` and register the same email again: *is already registered* with a link to
   sign in.
4. Sign in with a wrong password: *Invalid email or password*, the password field is emptied.
5. Sign in with the right one: the health page opens and the header shows *Sign out*.
6. Stop the backend and sign in again: a message above the form, *not reachable* or *Something went
   wrong*, depending on whether the dev server proxy answers with an error of its own.

## Notes for Windows

* In PowerShell, `npm` resolves to `npm.ps1`, which the default execution policy blocks. Use
  `npm.cmd` instead (`npm.cmd test`), or run the commands in `cmd.exe`.
