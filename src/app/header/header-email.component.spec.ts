import { TestBed } from '@angular/core/testing';
import { HeaderEmailComponent } from './header-email.component';

describe('HeaderEmailComponent', () => {
  // How the email is cut is the business of `shortenEmail`; here what the box shows and hints.
  function render(email: string | null): HTMLElement {
    const fixture = TestBed.createComponent(HeaderEmailComponent);
    fixture.componentRef.setInput('email', email);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a short email whole, without a hint', () => {
    const element = render('qwe@gmail.com');

    expect(element.textContent!.trim()).toBe('qwe@gmail.com');
    expect(element.hasAttribute('title')).toBeFalse();
  });

  it('shows a long email cut, with the full one as its hint', () => {
    const element = render('qwe.very.long.name@gmail.com');

    expect(element.textContent!.trim()).toBe('qwe.very.…@gmail.com');
    expect(element.title).toBe('qwe.very.long.name@gmail.com');
  });

  it('stays empty, without a hint, until the email is known', () => {
    const element = render(null);

    expect(element.textContent!.trim()).toBe('');
    expect(element.hasAttribute('title')).toBeFalse();
  });
});
