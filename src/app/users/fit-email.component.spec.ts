import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FitEmailComponent } from './fit-email.component';

@Component({
  standalone: true,
  imports: [FitEmailComponent],
  // A box of a fixed width, as the cell of the table gives it.
  template: `<div [style.width.px]="width()" style="font: 16px monospace"><app-fit-email [email]="email()" /></div>`,
})
class HostComponent {
  readonly email = signal('qwe.very.long.name@gmail.com');
  readonly width = signal(400);
}

describe('FitEmailComponent', () => {
  // How much is kept is the business of `fitEmail`; here the wiring in a real browser: the width
  // and the font of the box, a change of the width, the hint and what is read out.
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
  });

  async function show(width: number, email = 'qwe.very.long.name@gmail.com'): Promise<HTMLElement> {
    fixture.componentInstance.email.set(email);
    fixture.componentInstance.width.set(width);
    fixture.detectChanges();
    // The width comes from a ResizeObserver, after the layout.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('app-fit-email')!;
  }

  function shown(box: HTMLElement): HTMLElement {
    return box.querySelector('[aria-hidden="true"]')!;
  }

  it('shows an email that fits whole, without a hint', async () => {
    // 28 characters of 16px monospace, about 270px.
    const box = await show(400);

    expect(shown(box).textContent).toBe('qwe.very.long.name@gmail.com');
    expect(box.hasAttribute('title')).toBeFalse();
  });

  it('cuts it to the width of the box, filling it, with the whole email as the hint', async () => {
    const box = await show(200);

    const text = shown(box).textContent!;
    expect(text).toMatch(/^qwe\.very\..*…@gmail\.com$/);
    const width = shown(box).getBoundingClientRect().width;
    expect(width).toBeLessThanOrEqual(200);
    // Less than one more character of the font would take.
    expect(200 - width).toBeLessThan(10);
    expect(box.title).toBe('qwe.very.long.name@gmail.com');
  });

  it('cuts it again when the box changes its width', async () => {
    const box = await show(200);
    const narrow = shown(box).textContent;

    await show(400);
    expect(shown(box).textContent).toBe('qwe.very.long.name@gmail.com');
    expect(box.hasAttribute('title')).toBeFalse();

    await show(150);
    expect(shown(box).textContent!.length).toBeLessThan(narrow!.length);
  });

  it('is read out whole, from a hidden text, whatever is shown', async () => {
    const box = await show(150);

    expect(box.querySelector('.whole')!.textContent).toBe('qwe.very.long.name@gmail.com');
    expect(box.textContent).toContain('qwe.very.long.name@gmail.com');
  });
});
