import { TestBed } from '@angular/core/testing';
import { Role } from '../auth/auth.model';
import { HeaderRoleComponent } from './header-role.component';

describe('HeaderRoleComponent', () => {
  function render(role: Role | null): string {
    const fixture = TestBed.createComponent(HeaderRoleComponent);
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.trim();
  }

  for (const role of ['USER', 'MANAGER', 'ADMIN'] as const) {
    it(`shows the role ${role} in parentheses`, () => {
      expect(render(role)).toBe(`(${role})`);
    });
  }

  it('stays empty until the role is known', () => {
    expect(render(null)).toBe('');
  });
});
