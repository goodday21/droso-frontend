# droso-frontend

Angular 22 application that shows the health of the service and of its PostgreSQL dependency, and
lets a user sign up and sign in. The header of every page shows the email and the role of the
signed-in user.

It talks to the backend, [droso-backend](https://github.com/goodday21/droso-backend), through
`GET /api/v1/health`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`,
`POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all` and
`GET /api/v1/auth/me`; the
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
| `/login`    | Sign in; on success it keeps the token and opens `/`; `?expired=1` tells that the session has ended |
| `/user-profile` | The email and the role of the signed-in user, and *Logout all sessions*; signed-in users only (`authGuard`), anyone else is sent to `/login` |

Any other path shows *Page not found*.

The access token is kept in `localStorage` (`AuthSessionService`): every tab shares one session, a
tab opened later is signed in as well, and a sign-in or a sign-out in one tab reaches the others at
once (`storage` event). The token lives 15 minutes (`expiresIn`); the refresh token comes with the
login as an `HttpOnly` cookie (`droso_refresh`, `Path=/api/v1/auth`, 7 days from the last refresh),
which no script reads: the browser sends it to `POST /auth/refresh` and `POST /auth/logout` by
itself, same-origin through the dev server proxy.

The backend replaces the cookie on every refresh and ends the whole login when an old one comes
again, so a refresh is never sent twice at once: `RefreshTokenService` shares one refresh among
the calls of a tab and takes the Web Lock `droso-auth-refresh` across the tabs; under the lock it
first reads the storage again and reuses a token that another tab has just got. The Web Locks API
exists only in a secure context (`https://`, `localhost`); without it only one tab at a time is safe.

* `authInterceptor` sends the token as `Authorization: Bearer …` to every call of the API except
  `health`, `auth/register`, `auth/login`, `auth/refresh` and `auth/logout`: the backend rejects an
  invalid token with 401 even on a public endpoint. On a 401 `UNAUTHORIZED` it refreshes and sends
  the call once more. When the backend refuses the refresh (`INVALID_REFRESH_TOKEN`, `FORBIDDEN`),
  rejects the new token too, or rejects a token got less than 30 seconds ago, the session is
  cleared and the page opens `/login?expired=1`. When the refresh gets no answer, the call fails
  and the session is kept.
* `SessionKeeperService`, started by the initializer of the application, refreshes silently
  before the first page when there is no valid token: a user who comes back within a week is signed
  in without a password, and a guest just stays one (each start of a guest shows one 401 of the
  refresh in the console). It replaces the token a minute before it expires, and when the tab
  becomes visible again with an expired token. When the window gets the focus or the tab becomes
  visible with a valid token, it asks `GET /me` again (at most once in 2 seconds): *Logout all
  sessions* in another browser ends the session on the backend, which tells no other browser, and
  the 401 ends it here as well. When another tab ends the session, it opens `/login`.
* *Sign out* in the header forgets the session at once, opens `/login` and revokes the cookie with
  `POST /auth/logout` under the same lock. The other tabs open `/login` as well.
* *Logout all sessions* on `/user-profile` asks first in a dialog of the page, which closes on
  *Cancel*, on Escape, on a click outside it, or once the backend has accepted *Yes*. Then
  `POST /auth/logout-all` ends every login of the user on every device; the session is cleared and
  every tab opens `/login`. When the call fails, the dialog shows the error and the session stays.
* `authGuard` lets only a signed-in user (any role) into `/user-profile`: a valid token is checked
  with `GET /me` first, an expired one is refreshed; anyone else is sent to `/login`.

The header of every page shows a signed-in user the tabs of the pages on the left (`HEADER_TABS`
in `src/app/header/header-tabs.ts`, for now only *User Profile*; the tab of the open page is
marked), and on the right the email, the role as *(USER)*, *(MANAGER)* or *(ADMIN)*, and *Sign
out*. The email is plain text, cut to 20 characters with the domain kept whole
(`qwe.very.…@gmail.com`; with a long domain, the middle of the whole email), and the full one is
shown on hover (`title`). *Sign out* stays at the right edge; the role, always whole, is as wide as
its text and sits right before it; the email has a box of a fixed width (that of 20 × `m` in the
font of the page) with the text at its right edge, right before the role, so that the two read as
one line. A guest gets *Sign in* and *Sign up* on the right. Below the header,
`/user-profile` has a bar of its own: *Back* (to the previous page of the tab, or to `/` when
opened directly) and the title.

The email and the role, in the header and on `/user-profile`, come from `CurrentUserService`, which
reads them from `GET /api/v1/auth/me` once per token (at the start, on a sign-in, on a sign-in in another tab), not
from the claim `role` of the token: the claim is the role at the login, while the backend applies a
change of the role at once and lists the permissions as well. Until the answer comes, and when the
call fails, the header shows neither the email nor the role; `/user-profile` shows *Loading…*, and
*Could not load the profile.* on a failure. A 401 is handled by `authInterceptor`
(see above).

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

The tests of `e2e/mocked/` need no backend: `ApiMock` (`e2e/support/api-mock.ts`) answers every
call of the API in the browser, keyed by the method and the path, e.g. `api.respond('GET /auth/me',
currentUser())`. Only two calls have a default: the health endpoint is UP, and the refresh answers
401 `INVALID_REFRESH_TOKEN`, as for a guest without a cookie. Every other answer is set by the test,
and a call it did not mock fails it.

They check only what needs a real browser: typing and clicks, navigation and titles, the session
in `localStorage` across a reload and across tabs, a second click while a request is pending, the
layout of the header.
What each answer of the API shows on a page — every error code, a stopped backend, no network —
is checked by the unit and component tests. The skill `.claude/skills/test-pyramid` describes
where each kind of test belongs.

* `e2e/pages/` — page objects of the two forms and of the header (with the email and the role);
* `e2e/support/responses.ts` — the answers of the backend, following its API contract;
* `e2e/support/session.ts` — reading and seeding the session in `localStorage`.

To run one file or one test: `npm run e2e -- e2e/mocked/login.spec.ts` or `npm run e2e -- -g "pending"`.

### Against the real backend

The tests of `e2e/integration/` go through the proxy of the dev server to the backend, so start it
first, as in [Manual walkthrough](#manual-walkthrough) (`./gradlew bootRunWithPostgres` with
`DROSO_JWT_SECRET` set):

```bash
npm run e2e:integration      # headless
npm run e2e:integration:ui   # the UI mode of Playwright
```

The UI mode does not run the dependencies of a project: the check of the backend runs there only
when the project `integration-setup` is ticked as well (the arrow left of *Filter*, then
*Projects*). Without the backend the tests simply fail.

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
5. Sign in with the right one: the health page opens and the header shows the tab *User Profile* on the
   left, the email, *(USER)* and *Sign out* on the right.
6. Stop the backend and sign in again: a message above the form, *not reachable* or *Something went
   wrong*, depending on whether the dev server proxy answers with an error of its own.

## Notes for Windows

* In PowerShell, `npm` resolves to `npm.ps1`, which the default execution policy blocks. Use
  `npm.cmd` instead (`npm.cmd test`), or run the commands in `cmd.exe`.
