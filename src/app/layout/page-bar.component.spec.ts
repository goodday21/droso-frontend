import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Router, provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { PageBarComponent } from './page-bar.component';

@Component({
  standalone: true,
  imports: [PageBarComponent],
  template: `<app-page-bar title="Users" />`,
})
class HostComponent {}

@Component({
  standalone: true,
  imports: [PageBarComponent],
  template: `<app-page-bar title="Sign in" [back]="false" />`,
})
class HostWithoutBackComponent {}

describe('PageBarComponent', () => {
  let navigateByUrl: jasmine.Spy;
  let back: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTaiga()] });
    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    back = spyOn(TestBed.inject(Location), 'back');
  });

  /** The bar, created while the router is on its way to the page (or not), after `previous`. */
  function render(previous: object | null): HTMLElement {
    Object.defineProperty(TestBed.inject(Router), 'currentNavigation', {
      value: signal({ previousNavigation: previous }),
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('app-page-bar')!;
  }

  it('shows Back, then the title as the heading of the page', () => {
    const bar = render(null);

    expect(Array.from(bar.children, (item) => item.textContent!.trim())).toEqual(['Back', 'Users']);
    expect(bar.querySelector('h1')!.textContent).toBe('Users');
  });

  it('shows the title alone when the page has no Back', () => {
    const fixture = TestBed.createComponent(HostWithoutBackComponent);
    fixture.detectChanges();
    const bar = (fixture.nativeElement as HTMLElement).querySelector('app-page-bar')!;

    expect(Array.from(bar.children, (item) => item.textContent!.trim())).toEqual(['Sign in']);
    expect(bar.querySelector('button')).toBeNull();
  });

  it('goes back to the page it was opened from', () => {
    render({}).querySelector('button')!.click();

    expect(back).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('opens the root when the page was opened directly', () => {
    render(null).querySelector('button')!.click();

    expect(back).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledOnceWith('/');
  });
});
