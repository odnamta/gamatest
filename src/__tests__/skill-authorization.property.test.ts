import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  canManageSkillDomains,
  canLinkDeckToSkill,
  canViewOrgSkillScores,
  canViewOwnSkillScores,
  canManageRoleProfiles,
  canAssignRoles,
} from '@/lib/skill-authorization';
import type { OrgRole } from '@/types/database';

/**
 * Skill Authorization Property-Based Tests
 *
 * Validates RBAC rules for skill domain operations.
 * Role hierarchy: owner (3) > admin (2) > creator (1) > candidate (0)
 */

const ALL_ROLES: OrgRole[] = ['owner', 'admin', 'creator', 'candidate'];
const ROLE_LEVELS: Record<OrgRole, number> = {
  candidate: 0,
  creator: 1,
  admin: 2,
  owner: 3,
};

const roleArb = fc.constantFrom<OrgRole>('owner', 'admin', 'creator', 'candidate');

describe('Skill Authorization: canManageSkillDomains', () => {
  test('admin and above can manage skill domains', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        const result = canManageSkillDomains(role);
        const expected = ROLE_LEVELS[role] >= ROLE_LEVELS['admin'];
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  test('candidate and creator cannot manage skill domains', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<OrgRole>('candidate', 'creator'),
        (role) => {
          expect(canManageSkillDomains(role)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('owner and admin can manage skill domains', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<OrgRole>('owner', 'admin'),
        (role) => {
          expect(canManageSkillDomains(role)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Skill Authorization: canLinkDeckToSkill', () => {
  test('creator and above can link decks to skills', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        const result = canLinkDeckToSkill(role);
        const expected = ROLE_LEVELS[role] >= ROLE_LEVELS['creator'];
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  test('candidate cannot link decks to skills', () => {
    expect(canLinkDeckToSkill('candidate')).toBe(false);
  });
});

describe('Skill Authorization: canViewOrgSkillScores', () => {
  test('only admin+ can view org-wide skill scores', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        const result = canViewOrgSkillScores(role);
        const expected = ROLE_LEVELS[role] >= ROLE_LEVELS['admin'];
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Skill Authorization: canViewOwnSkillScores', () => {
  test('admin+ can always view own scores regardless of visibility setting', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<OrgRole>('owner', 'admin'),
        fc.boolean(),
        (role, visible) => {
          expect(canViewOwnSkillScores(role, visible)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('non-admin roles depend on skillsVisibleToCandidates flag', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<OrgRole>('creator', 'candidate'),
        fc.boolean(),
        (role, visible) => {
          expect(canViewOwnSkillScores(role, visible)).toBe(visible);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('defaults to visible when no flag is passed', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        const result = canViewOwnSkillScores(role);
        // Admin+ always true; others default to true (skillsVisibleToCandidates defaults to true)
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Skill Authorization: role hierarchy consistency', () => {
  test('higher roles always have at least the same permissions as lower roles', () => {
    fc.assert(
      fc.property(roleArb, roleArb, (roleA, roleB) => {
        // If roleA >= roleB in hierarchy, roleA should have all permissions roleB has
        if (ROLE_LEVELS[roleA] >= ROLE_LEVELS[roleB]) {
          if (canManageSkillDomains(roleB)) {
            expect(canManageSkillDomains(roleA)).toBe(true);
          }
          if (canLinkDeckToSkill(roleB)) {
            expect(canLinkDeckToSkill(roleA)).toBe(true);
          }
          if (canViewOrgSkillScores(roleB)) {
            expect(canViewOrgSkillScores(roleA)).toBe(true);
          }
          if (canManageRoleProfiles(roleB)) {
            expect(canManageRoleProfiles(roleA)).toBe(true);
          }
          if (canAssignRoles(roleB)) {
            expect(canAssignRoles(roleA)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('canManageRoleProfiles and canAssignRoles have same threshold as canManageSkillDomains', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        // All three require admin+
        expect(canManageRoleProfiles(role)).toBe(canManageSkillDomains(role));
        expect(canAssignRoles(role)).toBe(canManageSkillDomains(role));
      }),
      { numRuns: 100 }
    );
  });

  test('all authorization checks are deterministic', () => {
    fc.assert(
      fc.property(roleArb, fc.boolean(), (role, visible) => {
        expect(canManageSkillDomains(role)).toBe(canManageSkillDomains(role));
        expect(canLinkDeckToSkill(role)).toBe(canLinkDeckToSkill(role));
        expect(canViewOrgSkillScores(role)).toBe(canViewOrgSkillScores(role));
        expect(canViewOwnSkillScores(role, visible)).toBe(canViewOwnSkillScores(role, visible));
        expect(canManageRoleProfiles(role)).toBe(canManageRoleProfiles(role));
        expect(canAssignRoles(role)).toBe(canAssignRoles(role));
      }),
      { numRuns: 100 }
    );
  });
});
