import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthSessionService } from './auth/auth-session.service';

describe('AppComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('droso.session');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => localStorage.removeItem('droso.session'));

  function linksOf(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('nav a, nav button'), (item) => item.textContent!.trim());
  }

  it('offers to sign in or to sign up without a session', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(linksOf(fixture.nativeElement)).toEqual(['Service health', 'Sign in', 'Sign up']);
  });

  it('signs out with the button of the header', () => {
    const session = TestBed.inject(AuthSessionService);
    session.save('eyJ.x.y', 1800);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(linksOf(fixture.nativeElement)).toEqual(['Service health', 'Sign out']);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('nav button')!.click();
    fixture.detectChanges();

    expect(session.isAuthenticated()).toBeFalse();
    expect(linksOf(fixture.nativeElement)).toEqual(['Service health', 'Sign in', 'Sign up']);
  });
});
