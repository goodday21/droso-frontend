import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { HealthApiService } from './health-api.service';
import { HealthCheckOutcome } from './health.model';

/** The badge of each state: UP green, DOWN red, CHECKING grey. */
const STATE_APPEARANCE = { up: 'positive', down: 'negative', unknown: 'neutral' } as const;

/**
 * Shows the current health of the service and of its PostgreSQL dependency: the state as a badge
 * of Taiga UI, *Refresh*, and the details of the last answer; a message when the service is not
 * reachable.
 */
@Component({
  selector: 'app-health-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiBadge, TuiButton, TuiNotification],
  template: `
    <section class="card" [attr.data-state]="state()">
      <div class="row">
        <span tuiBadge size="l" [appearance]="appearance()">{{ label() }}</span>
        <button
          tuiButton
          type="button"
          appearance="secondary"
          size="s"
          iconStart="@tui.refresh-cw"
          (click)="refresh()"
          [disabled]="loading()"
        >
          Refresh
        </button>
      </div>

      @if (outcome(); as result) {
        @switch (result.kind) {
          @case ('up') {
            <dl>
              <dt>Database</dt>
              <dd>{{ result.body.database.status }}</dd>
              <dt>Latency (ms)</dt>
              <dd>{{ result.body.database.latencyMs }} ms</dd>
              <dt>Checked at</dt>
              <dd>{{ result.body.timestamp }}</dd>
            </dl>
          }
          @case ('down') {
            <dl>
              <dt>Database</dt>
              <dd>DOWN</dd>
              <dt>HTTP status</dt>
              <dd>{{ result.httpStatus }}</dd>
              @if (result.body) {
                <dt>Checked at</dt>
                <dd>{{ result.body.timestamp }}</dd>
              }
            </dl>
          }
          @case ('unreachable') {
            <div tuiNotification appearance="negative" size="m" class="message">{{ result.message }}</div>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .card {
        display: grid;
        gap: 1.25rem;
        padding: 1.5rem;
        background: var(--tui-background-base);
        border-radius: var(--tui-radius-l);
        box-shadow: 0 0.25rem 1.5rem rgba(0, 0, 0, 0.06);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.5rem 1.5rem;
        margin: 0;
        font: var(--tui-typography-body-m);
      }
      dt {
        color: var(--tui-text-secondary);
      }
      dd {
        margin: 0;
        color: var(--tui-text-primary);
      }
    `,
  ],
})
export class HealthPanelComponent {
  private readonly api = inject(HealthApiService);

  readonly outcome = signal<HealthCheckOutcome | null>(null);
  readonly loading = signal(false);

  constructor() {
    this.refresh();
  }

  state(): 'up' | 'down' | 'unknown' {
    const result = this.outcome();
    if (!result) {
      return 'unknown';
    }
    return result.kind === 'up' ? 'up' : 'down';
  }

  protected appearance(): string {
    return STATE_APPEARANCE[this.state()];
  }

  label(): string {
    switch (this.state()) {
      case 'up':
        return 'UP';
      case 'down':
        return 'DOWN';
      default:
        return 'CHECKING';
    }
  }

  refresh(): void {
    this.loading.set(true);
    this.api.check().subscribe((result) => {
      this.outcome.set(result);
      this.loading.set(false);
    });
  }
}