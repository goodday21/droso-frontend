import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { relative, sep } from 'node:path';

/** The id of a browser test: `@E2E-` and three digits, e.g. `@E2E-007`. */
const ID = /^@E2E-\d{3}$/;

/**
 * Fails the run when a browser test has no id, or more than one, or shares its id with another
 * test. Meant for `npm run e2e:ids` (`playwright test --list`), which sees the tests of every
 * project without running them; the checks of `*.setup.ts` need no id.
 */
export default class TestIdsReporter implements Reporter {
  private readonly problems: string[] = [];
  private nextId = 1;

  onBegin(config: FullConfig, suite: Suite): void {
    // A test of two projects is two cases of one place: one id.
    const places = new Map<string, TestCase>();
    for (const test of suite.allTests()) {
      if (!test.location.file.endsWith('.setup.ts')) {
        places.set(`${test.location.file}:${test.location.line}`, test);
      }
    }

    const byId = new Map<string, string[]>();
    for (const test of places.values()) {
      const place = `${relative(config.rootDir, test.location.file).replaceAll(sep, '/')}:${test.location.line}`;
      const ids = test.tags.filter((tag) => ID.test(tag));
      if (ids.length !== 1) {
        this.problems.push(`${place} "${test.title}" has ${ids.length} ids instead of one`);
        continue;
      }
      byId.set(ids[0], [...(byId.get(ids[0]) ?? []), place]);
      this.nextId = Math.max(this.nextId, Number(ids[0].slice('@E2E-'.length)) + 1);
    }
    for (const [id, where] of byId) {
      if (where.length > 1) {
        this.problems.push(`${id} is the id of ${where.length} tests: ${where.join(', ')}`);
      }
    }
  }

  async onEnd(): Promise<{ status?: FullResult['status'] } | undefined> {
    if (this.problems.length > 0) {
      console.error(`The ids of the browser tests are wrong:\n${this.problems.map((p) => `  ${p}`).join('\n')}`);
      return { status: 'failed' };
    }
    console.log(`The ids of the browser tests are unique. The next free id: @E2E-${String(this.nextId).padStart(3, '0')}`);
    return undefined;
  }

  printsToStdio(): boolean {
    return true;
  }
}
