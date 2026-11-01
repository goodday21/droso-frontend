import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { Role } from '../auth/auth.model';
import { HeaderRoleComponent } from './header-role.component';

describe('HeaderRoleComponent', () => {
  function render(role: Role | null): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideTaiga()] });
    const fixture = TestBed.createComponent(HeaderRoleComponent);
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  for (const role of ['USER', 'MANAGER', 'ADMIN'] as const) {
    it(`shows the role ${role} as a badge`, () => {
      const badge = render(role).querySelector('[tuiBadge]');

      expect(badge?.textContent!.trim()).toBe(role);
    });
  }

  it('stays empty, without a badge, until the role is known', () => {
    const element = render(null);

    expect(element.textContent!.trim()).toBe('');
    expect(element.querySelector('[tuiBadge]')).toBeNull();
  });
});
