import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { fitEmail } from './fit-email';

/**
 * An email that takes the whole width of its box and is cut only when it does not fit, by
 * {@link fitEmail}: `qwe.very.long.na…@gmail.com`, with the whole email as the hint when cut.
 *
 * The text is measured in the font of the box, and cut again whenever the box changes its width.
 * The whole email is read out from a hidden text of its own, not the cut one on the screen.
 */
@Component({
  selector: 'app-fit-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.title]': 'cut() ? email() : null' },
  template: `<span class="whole">{{ email() }}</span><span aria-hidden="true">{{ shown() }}</span>`,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
      }
      .whole {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
    `,
  ],
})
export class FitEmailComponent {
  readonly email = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** The width of the box; `null` until it is known, when the email is shown whole. */
  private readonly width = signal<number | null>(null);

  protected readonly shown = computed(() => {
    const width = this.width();
    return width === null ? this.email() : fitEmail(this.email(), width, (text) => this.measure(text));
  });

  protected readonly cut = computed(() => this.shown() !== this.email());

  private context: CanvasRenderingContext2D | null = null;

  constructor() {
    const observer = new ResizeObserver(([entry]) => {
      // The font may have changed with the width (another font loaded, a zoom).
      this.context = null;
      this.width.set(entry.contentRect.width);
    });
    observer.observe(this.host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  private measure(text: string): number {
    if (this.context === null) {
      this.context = document.createElement('canvas').getContext('2d')!;
      this.context.font = getComputedStyle(this.host).font;
    }
    return this.context.measureText(text).width;
  }
}
