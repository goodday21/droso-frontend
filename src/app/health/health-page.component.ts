import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageBarComponent } from '../layout/page-bar.component';
import { HealthPanelComponent } from './health-panel.component';

/**
 * The root page of the application.
 */
@Component({
  selector: 'app-health-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageBarComponent, HealthPanelComponent],
  template: `
    <app-page-bar title="Service health" [back]="false" />
    <app-health-panel />
  `,
})
export class HealthPageComponent {}
