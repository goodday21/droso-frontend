# droso-frontend

See `README.md` for the application, the scripts and the layers of tests.

## Layout

The application is for desktop browsers only: narrow windows and mobile devices are not a target.
Do not add layouts or media queries for small widths, nor tests at narrow viewports; the browser
tests run at the viewport of *Desktop Chrome*. A page that breaks in a narrow window is not a known
limitation to report.

## Tests

Before committing a change that adds or changes tests, run the skill `/test-pyramid`
(`.claude/skills/test-pyramid/SKILL.md`) and put its result in the report of the task and in the
description of the pull request. Change the tests it proposes to change only once the user agrees.
