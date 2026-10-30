import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthSessionService } from './auth-session.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: AuthSessionService;

  beforeEach(() => {
    localStorage.removeItem('droso.session');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('droso.session');
  });

  function authorizationOf(url: string): string | null {
    http.get(url).subscribe();
    const request = httpMock.expectOne(url);
    request.flush({});
    return request.request.headers.get('Authorization');
  }

  it('sends the token to a protected endpoint', () => {
    session.save('eyJ.x.y', 1800);

    expect(authorizationOf('/api/v1/auth/me')).toBe('Bearer eyJ.x.y');
  });

  it('sends no token without a session', () => {
    expect(authorizationOf('/api/v1/auth/me')).toBeNull();
  });

  it('sends no expired token', () => {
    const now = Date.now();
    session.save('eyJ.x.y', 1800);
    spyOn(Date, 'now').and.returnValue(now + 1801 * 1000);

    expect(authorizationOf('/api/v1/auth/me')).toBeNull();
  });

  for (const url of ['/api/v1/health', '/api/v1/auth/login', '/api/v1/auth/register', '/assets/x.json']) {
    it(`sends no token to ${url}, which needs none`, () => {
      session.save('eyJ.x.y', 1800);

      expect(authorizationOf(url)).toBeNull();
    });
  }
});
