---
name: test-pyramid
description: Review the test pyramid of droso-frontend — count the tests per layer, find scenarios checked on two layers and logic left without its own unit test, and propose what to add, move or drop. Use before committing a change that adds or changes tests, and when asked to assess the tests or the pyramid.
---

# Test pyramid review

Run it before the commit of any change that adds or changes tests (see `CLAUDE.md`), or on request.
It ends with a report. Change nothing before the user agrees to the proposal.

## 1. Count the tests per layer

| Layer | Where | How to recognise it |
|---|---|---|
| unit, pure functions | `src/**/*.spec.ts` | no `TestBed` |
| unit, services | `src/**/*.spec.ts` | `TestBed.inject` of a service, `HttpTestingController`, no component |
| component | `src/**/*.spec.ts` | `TestBed.createComponent`, `RouterTestingHarness`, `app.routes.spec.ts` |
| browser, mocked API | `e2e/mocked/` | Playwright with the fixture of `e2e/support/fixtures.ts` |
| browser, real backend | `e2e/integration/` | Playwright against the running backend |

```bash
grep -rcE "^\s*it\(" src/app --include=*.spec.ts   # Jasmine, per file
npx playwright test --list                         # Playwright, per project (no backend needed)
```

A loop over cases counts once per case. The `integration-setup` project is a check of the
environment, not a test. Give the counts before and after the change.

## 2. Where a test belongs

Each behaviour is checked on the lowest layer that can see it, and on one layer only.

* **Unit, pure functions** — every branch of the logic without Angular: `api/api-error.ts`,
  `auth/form-errors.ts`, models and mappers. New logic with branches gets its own spec here, not
  only through a page.
* **Unit, services** — the HTTP contract (method, URL, body), the mapping of the answers to
  results, `localStorage` and the `storage` event.
* **Component** — the matrix "answer of the API → what the page shows": each error code, field
  errors, general messages, the state of the button, the redirect after a success, what happens
  to the fields. One test per branch of the wiring is enough when the message itself is covered
  by a unit test.
* **Browser, mocked API** — only what needs a real browser: typing and clicks, navigation, the
  URL and the `<title>`, `localStorage` across a reload and across tabs, a second click while the
  request is pending, CSS classes such as `invalid`. Not one test per error code.
* **Browser, real backend** — that the mocks match the backend: the main flow, and the answers
  whose shape the backend decides (rules of the password, 409, 401). Keep it small: it needs the
  backend and is the slowest job of CI.

## 3. Checklist

* Is a scenario of the change checked on two neighbouring layers? Compare the new tests with the
  specs of the same page or service on the other layers, name by name.
* Did logic with branches appear without a spec of its own?
* Does a component spec that uses `HttpTestingController` call `httpMock.verify()` after each test?
* Before dropping a test, move the assertions that no other test makes (for example, "the
  password is kept" or "the button is enabled again") to the layer that keeps the scenario.
* After dropping tests, remove the helpers, responses and mock variants that nothing uses any
  more, and check with `npx tsc -p e2e`.
* Do the README sections on tests still describe what each layer covers?

## 4. Report

In the language of the conversation:

1. A table of the layers: before → after the change.
2. Duplicates: the scenario, the files and tests on both layers, which one to keep and why.
3. Gaps: what has no test on its proper layer.
4. The proposal: what to add, move or drop, with the expected counts.

If nothing is to change, say so in one line with the table. Once the user agrees, make the
changes and run `npm test`, `npx tsc -p e2e` and `npm run e2e` before the commit.
