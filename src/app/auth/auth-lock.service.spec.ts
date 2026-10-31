import { TestBed } from '@angular/core/testing';
import { AuthLockService } from './auth-lock.service';

describe('AuthLockService', () => {
  it('runs the tasks one at a time', async () => {
    const lock = TestBed.inject(AuthLockService);
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const firstStarted = new Promise<void>((resolve) => (started = resolve));

    const first = lock.run(async () => {
      events.push('first starts');
      started();
      await gate;
      events.push('first ends');
    });
    const second = lock.run(async () => {
      events.push('second starts');
    });
    // The browser grants a lock asynchronously, and on a busy machine not within a fixed delay.
    await firstStarted;
    // A chance for the second task to start, if the lock did not hold it back.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(events).withContext('while the first holds the lock').toEqual(['first starts']);

    release();
    await Promise.all([first, second]);

    expect(events).toEqual(['first starts', 'first ends', 'second starts']);
  });

  it('runs the task at once without the Web Locks API', async () => {
    spyOnProperty(navigator, 'locks').and.returnValue(undefined as unknown as LockManager);

    expect(await TestBed.inject(AuthLockService).run(async () => 'done')).toBe('done');
  });
});
