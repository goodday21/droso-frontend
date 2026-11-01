import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTaiga } from '@taiga-ui/core';
import { Role } from '../auth/auth.model';
import { RoleBadgeComponent } from '../layout/role-badge.component';
import { HeaderRoleComponent } from './header-role.component';

describe('HeaderRoleComponent', () => {
  // The text and the colour of the badge are the business of `RoleBadgeComponent`.
  function render(role: Role | null) {
    TestBed.configureTestingModule({ providers: [provideTaiga()] });
    const fixture = TestBed.createComponent(HeaderRoleComponent);
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    return fixture;
  }

  it('gives the role to the badge of its colour', () => {
    const badge = render('MANAGER').debugElement.query(By.directive(RoleBadgeComponent));

    expect((badge.componentInstance as RoleBadgeComponent).role()).toBe('MANAGER');
  });

  it('stays empty, without a badge, until the role is known', () => {
    const fixture = render(null);

    expect((fixture.nativeElement as HTMLElement).textContent!.trim()).toBe('');
    expect(fixture.debugElement.query(By.directive(RoleBadgeComponent))).toBeNull();
  });
});
