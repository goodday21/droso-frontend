import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HealthApiService } from './health-api.service';
import { HealthCheckOutcome, HealthResponseBody } from './health.model';

describe('HealthApiService', () => {
  let service: HealthApiService;
  let httpMock: HttpTestingController;

  const upBody: HealthResponseBody = {
    status: 'UP',
    database: { status: 'UP', latencyMs: 4 },
    timestamp: '2026-10-22T10:00:00Z',
  };

  const downBody: HealthResponseBody = {
    status: 'DOWN',
    database: { status: 'DOWN', latencyMs: 2000 },
    timestamp: '2026-10-22T10:00:01Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HealthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function check(): () => HealthCheckOutcome | undefined {
    let outcome: HealthCheckOutcome | undefined;
    let failed = false;
    service.check().subscribe({ next: (result) => (outcome = result), error: () => (failed = true) });
    return () => {
      expect(failed).withContext('the observable failed').toBeFalse();
      return outcome;
    };
  }

  it('maps HTTP 200 of GET /api/v1/health to the "up" outcome', () => {
    const outcome = check();

    const request = httpMock.expectOne('/api/v1/health');
    expect(request.request.method).toBe('GET');
    request.flush(upBody, { status: 200, statusText: 'OK' });

    expect(outcome()).toEqual({ kind: 'up', body: upBody });
  });

  it('maps HTTP 503 to the "down" outcome instead of an error', () => {
    const outcome = check();

    httpMock
      .expectOne('/api/v1/health')
      .flush(downBody, { status: 503, statusText: 'Service Unavailable' });

    expect(outcome()).toEqual({ kind: 'down', body: downBody, httpStatus: 503 });
  });

  it('maps a network error to the "unreachable" outcome', () => {
    const outcome = check();

    httpMock.expectOne('/api/v1/health').error(new ProgressEvent('network error'), {
      status: 0,
      statusText: 'Unknown Error',
    });

    expect(outcome()?.kind).toBe('unreachable');
  });

  it('maps an unexpected status to the "unreachable" outcome', () => {
    const outcome = check();

    httpMock.expectOne('/api/v1/health').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(outcome()).toEqual({ kind: 'unreachable', message: 'Unexpected response status 500' });
  });
});