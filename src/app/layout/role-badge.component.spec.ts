import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { Role } from '../auth/auth.model';
import { RoleBadgeComponent } from './role-badge.component';

describe('RoleBadgeComponent', () => {
  // The colours themselves are those of the appearances of the theme of Taiga UI.
  const cases: [Role, string][] = [
    ['ADMIN', 'primary-destructive'],
    ['MANAGER', 'primary'],
    ['USER', 'neutral'],
  ];

  for (const [role, appearance] of cases) {
    it(`shows ${role} as a badge of the appearance ${appearance}`, () => {
      TestBed.configureTestingModule({ providers: [provideTaiga()] });
      const fixture = TestBed.createComponent(RoleBadgeComponent);
      fixture.componentRef.setInput('role', role);
      fixture.detectChanges();

      const badge = (fixture.nativeElement as HTMLElement).querySelector('[tuiBadge]')!;
      expect(badge.textContent!.trim()).toBe(role);
      expect(badge.getAttribute('data-appearance')).toBe(appearance);
    });
  }
});
