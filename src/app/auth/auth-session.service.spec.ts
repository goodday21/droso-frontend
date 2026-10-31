import { TestBed } from '@angular/core/testing';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  const key = 'droso.session';

  beforeEach(() => localStorage.removeItem(key));
  afterEach(() => localStorage.removeItem(key));

  /** Another instance stands for another tab, or for a tab opened after this one was closed. */
  function anotherTab(): AuthSessionService {
    return TestBed.runInInjectionContext(() => new AuthSessionService());
  }

  it('has no token at first', () => {
    const session = TestBed.inject(AuthSessionService);

    expect(session.accessToken()).toBeNull();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('keeps a saved token in localStorage, for every tab', () => {
    TestBed.inject(AuthSessionService).save('eyJ.x.y', 1800);

    expect(anotherTab().accessToken()).toBe('eyJ.x.y');
  });

  it('forgets an expired token', () => {
    const now = Date.now();
    const session = TestBed.inject(AuthSessionService);
    session.save('eyJ.x.y', 1800);

    spyOn(Date, 'now').and.returnValue(now + 1801 * 1000);

    expect(session.accessToken()).toBeNull();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('forgets the token at the very moment it expires', () => {
    const now = Date.now();
    spyOn(Date, 'now').and.returnValue(now);
    const session = TestBed.inject(AuthSessionService);
    session.save('eyJ.x.y', 1800);

    (Date.now as jasmine.Spy).and.returnValue(now + 1800 * 1000 - 1);
    expect(session.accessToken()).toBe('eyJ.x.y');

    (Date.now as jasmine.Spy).and.returnValue(now + 1800 * 1000);
    expect(session.accessToken()).toBeNull();
  });

  it('clears the token and the storage', () => {
    const session = TestBed.inject(AuthSessionService);
    session.save('eyJ.x.y', 1800);

    session.clear();

    expect(session.accessToken()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('follows a sign-in and a sign-out made in another tab', () => {
    const session = TestBed.inject(AuthSessionService);
    const other = anotherTab();

    // The browser fires `storage` only in the other tabs; a test has to dispatch it itself.
    other.save('eyJ.x.y', 1800);
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(session.accessToken()).toBe('eyJ.x.y');

    other.clear();
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('ignores a change of another key', () => {
    const session = TestBed.inject(AuthSessionService);
    localStorage.setItem(key, JSON.stringify({ accessToken: 'eyJ.x.y', expiresAt: Date.now() + 1000 }));

    window.dispatchEvent(new StorageEvent('storage', { key: 'something.else' }));

    expect(session.accessToken()).toBeNull();
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem(key, '{not json');

    expect(TestBed.inject(AuthSessionService).accessToken()).toBeNull();
  });

  it('tells when another tab ends the session, and only then', () => {
    const session = TestBed.inject(AuthSessionService);
    const other = anotherTab();
    let ended = 0;
    session.endedElsewhere.subscribe(() => ended++);

    other.save('eyJ.x.y', 1800);
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(ended).withContext('a sign-in').toBe(0);

    other.clear();
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(ended).withContext('a sign-out').toBe(1);

    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(ended).withContext('no session to end').toBe(1);
  });

  it('reads the latest session of another tab before its event comes', () => {
    const session = TestBed.inject(AuthSessionService);
    anotherTab().save('eyJ.new', 900);

    expect(session.reload()?.accessToken).toBe('eyJ.new');
    expect(session.accessToken()).toBe('eyJ.new');
  });

  it('keeps an expired token as the stored session', () => {
    const now = Date.now();
    const session = TestBed.inject(AuthSessionService);
    session.save('eyJ.x.y', 900);
    spyOn(Date, 'now').and.returnValue(now + 901 * 1000);

    expect(session.accessToken()).toBeNull();
    expect(session.stored()?.accessToken).toBe('eyJ.x.y');
  });

  it('keeps the session in memory when the storage is unavailable', () => {
    const session = TestBed.inject(AuthSessionService);
    spyOn(localStorage, 'getItem').and.throwError('SecurityError');
    spyOn(localStorage, 'setItem').and.throwError('SecurityError');
    session.save('eyJ.x.y', 900);

    expect(session.reload()?.accessToken).toBe('eyJ.x.y');
    expect(session.accessToken()).toBe('eyJ.x.y');
  });
});
