import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { ACTIVE_ORG_COOKIE } from '../lib/org-context'
import type { OrgContext } from '../lib/org-context'
import type { Organization, OrgRole, OrgSettings } from '@/types/database'

/**
 * V13: Organization Context Property Tests
 * Validates the org resolution logic used by resolveActiveOrg.
 *
 * Since resolveActiveOrg is async and tightly coupled to Next.js cookies()
 * and Supabase, we extract and test the pure resolution logic synchronously,
 * following the pattern established in with-user-helper.property.test.ts.
 */

// ============================================
// Types mirroring the Supabase query shape
// ============================================

interface MembershipRow {
  role: OrgRole
  organizations: Organization | null
}

// ============================================
// Pure reimplementation of resolveActiveOrg logic
// ============================================

/**
 * Pure synchronous version of the org resolution logic.
 * Mirrors the branching in resolveActiveOrg without async/Supabase.
 *
 * @param user      - The authenticated user, or null
 * @param savedOrgId - The value from the active_org cookie, or undefined
 * @param memberships - All of the user's org memberships, sorted by joined_at ascending
 */
function resolveActiveOrgSync(
  user: { id: string } | null,
  savedOrgId: string | undefined,
  memberships: MembershipRow[]
): OrgContext | null {
  // No user => null
  if (!user) return null

  if (savedOrgId) {
    // Try to find membership matching the saved org
    const saved = memberships.find(
      (m) => m.organizations?.id === savedOrgId
    )
    if (saved && saved.organizations) {
      return {
        org: saved.organizations,
        role: saved.role,
      }
    }
    // Saved org not found — fall back to first membership
  }

  // Use first membership (or first membership as fallback when savedOrgId didn't match)
  const first = memberships[0]
  if (!first || !first.organizations) return null

  return {
    org: first.organizations,
    role: first.role,
  }
}

// ============================================
// Arbitraries
// ============================================

const ALL_ROLES: OrgRole[] = ['candidate', 'creator', 'admin', 'owner']
const roleArb = fc.constantFrom(...ALL_ROLES)
const uuidArb = fc.uuid()

const orgSettingsArb: fc.Arbitrary<OrgSettings> = fc.record({
  features: fc.record({
    study_mode: fc.boolean(),
    assessment_mode: fc.boolean(),
    skills_mapping: fc.boolean(),
    proctoring: fc.boolean(),
    certification: fc.boolean(),
    ai_generation: fc.boolean(),
    pdf_extraction: fc.boolean(),
    flashcards: fc.boolean(),
    erp_integration: fc.boolean(),
  }),
  branding: fc.record({
    primary_color: fc.stringMatching(/^#[0-9a-f]{6}$/),
    logo_url: fc.webUrl(),
  }),
  default_language: fc.constantFrom('id', 'en'),
})

const minTimestamp = new Date('2020-01-01').getTime()
const maxTimestamp = new Date('2030-12-31').getTime()
const isoDateArb = fc
  .integer({ min: minTimestamp, max: maxTimestamp })
  .map((ts) => new Date(ts).toISOString())

const organizationArb: fc.Arbitrary<Organization> = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  slug: fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/),
  settings: orgSettingsArb,
  created_at: isoDateArb,
  updated_at: isoDateArb,
})

const membershipRowArb: fc.Arbitrary<MembershipRow> = fc.record({
  role: roleArb,
  organizations: organizationArb,
})

const membershipRowWithNullOrgArb: fc.Arbitrary<MembershipRow> = fc.record({
  role: roleArb,
  organizations: fc.constant(null),
})

const userArb = fc.record({ id: uuidArb })

// ============================================
// Tests
// ============================================

describe('V13: Org Context — ACTIVE_ORG_COOKIE constant', () => {
  test('cookie name is a non-empty string', () => {
    expect(typeof ACTIVE_ORG_COOKIE).toBe('string')
    expect(ACTIVE_ORG_COOKIE.length).toBeGreaterThan(0)
  })

  test('cookie name uses a safe character set (alphanumeric + underscore)', () => {
    expect(ACTIVE_ORG_COOKIE).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
  })

  test('cookie name is cekatan_active_org_id', () => {
    expect(ACTIVE_ORG_COOKIE).toBe('cekatan_active_org_id')
  })
})

describe('V13: Org Context — No User', () => {
  test('returns null when user is null regardless of other inputs', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: undefined }),
        fc.array(membershipRowArb, { maxLength: 5 }),
        (savedOrgId, memberships) => {
          const result = resolveActiveOrgSync(null, savedOrgId, memberships)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('V13: Org Context — No Memberships', () => {
  test('returns null when membership list is empty', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.option(uuidArb, { nil: undefined }),
        (user, savedOrgId) => {
          const result = resolveActiveOrgSync(user, savedOrgId, [])
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('returns null when all memberships have null organizations', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.array(membershipRowWithNullOrgArb, { minLength: 1, maxLength: 5 }),
        (user, memberships) => {
          const result = resolveActiveOrgSync(user, undefined, memberships)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('V13: Org Context — Cookie-based Resolution', () => {
  test('returns the org matching savedOrgId when it exists in memberships', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        fc.array(membershipRowArb, { maxLength: 4 }),
        (user, targetMembership, otherMemberships) => {
          // Ensure the target org is present
          const targetOrgId = targetMembership.organizations!.id
          // Build memberships with target somewhere in the list
          const memberships = [...otherMemberships, targetMembership]

          const result = resolveActiveOrgSync(user, targetOrgId, memberships)

          expect(result).not.toBeNull()
          expect(result!.org.id).toBe(targetOrgId)
          expect(result!.role).toBe(targetMembership.role)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('falls back to first membership when savedOrgId does not match any membership', () => {
    fc.assert(
      fc.property(
        userArb,
        uuidArb,
        fc.array(membershipRowArb, { minLength: 1, maxLength: 5 }),
        (user, nonExistentOrgId, memberships) => {
          // Ensure the savedOrgId does not match any membership
          const orgIds = memberships
            .map((m) => m.organizations?.id)
            .filter(Boolean)
          fc.pre(!orgIds.includes(nonExistentOrgId))

          const result = resolveActiveOrgSync(user, nonExistentOrgId, memberships)

          // Should fall back to first membership
          const firstWithOrg = memberships[0]
          if (!firstWithOrg || !firstWithOrg.organizations) {
            expect(result).toBeNull()
          } else {
            expect(result).not.toBeNull()
            expect(result!.org.id).toBe(firstWithOrg.organizations.id)
            expect(result!.role).toBe(firstWithOrg.role)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('V13: Org Context — No Cookie (undefined savedOrgId)', () => {
  test('returns the first membership when no cookie is set', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.array(membershipRowArb, { minLength: 1, maxLength: 5 }),
        (user, memberships) => {
          const result = resolveActiveOrgSync(user, undefined, memberships)

          const first = memberships[0]
          if (!first || !first.organizations) {
            expect(result).toBeNull()
          } else {
            expect(result).not.toBeNull()
            expect(result!.org.id).toBe(first.organizations.id)
            expect(result!.role).toBe(first.role)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('always returns the first membership org, not a random one', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.array(membershipRowArb, { minLength: 2, maxLength: 5 }),
        (user, memberships) => {
          const result = resolveActiveOrgSync(user, undefined, memberships)

          // Should always return the first, never a later one (unless first has null org)
          const first = memberships[0]
          if (first && first.organizations) {
            expect(result).not.toBeNull()
            expect(result!.org.id).toBe(first.organizations.id)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('V13: Org Context — Single Membership', () => {
  test('returns the sole membership regardless of cookie value', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        fc.option(uuidArb, { nil: undefined }),
        (user, membership, savedOrgId) => {
          // If savedOrgId matches, we get it; if not, fallback is still the same single one
          const memberships = [membership]
          const result = resolveActiveOrgSync(user, savedOrgId, memberships)

          if (!membership.organizations) {
            expect(result).toBeNull()
          } else {
            expect(result).not.toBeNull()
            expect(result!.org.id).toBe(membership.organizations.id)
            expect(result!.role).toBe(membership.role)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('V13: Org Context — OrgContext Shape', () => {
  test('returned context always contains org and role fields', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        (user, membership) => {
          const result = resolveActiveOrgSync(user, undefined, [membership])
          if (result !== null) {
            expect(result).toHaveProperty('org')
            expect(result).toHaveProperty('role')
            expect(ALL_ROLES).toContain(result.role)
            expect(typeof result.org.id).toBe('string')
            expect(typeof result.org.name).toBe('string')
            expect(typeof result.org.slug).toBe('string')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('org in context matches the membership org exactly', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        (user, membership) => {
          const result = resolveActiveOrgSync(user, undefined, [membership])
          if (result !== null && membership.organizations) {
            expect(result.org).toEqual(membership.organizations)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('role in context matches the membership role exactly', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        (user, membership) => {
          const result = resolveActiveOrgSync(user, undefined, [membership])
          if (result !== null) {
            expect(result.role).toBe(membership.role)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('V13: Org Context — Cookie Priority', () => {
  test('cookie-matched org takes priority over first membership', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        membershipRowArb,
        (user, firstMembership, secondMembership) => {
          // Ensure they have different org IDs
          fc.pre(
            firstMembership.organizations !== null &&
            secondMembership.organizations !== null &&
            firstMembership.organizations.id !== secondMembership.organizations.id
          )

          const memberships = [firstMembership, secondMembership]
          const savedOrgId = secondMembership.organizations!.id

          const result = resolveActiveOrgSync(user, savedOrgId, memberships)

          // Should return the second (cookie-matched) org, NOT the first
          expect(result).not.toBeNull()
          expect(result!.org.id).toBe(secondMembership.organizations!.id)
          expect(result!.role).toBe(secondMembership.role)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('without cookie, always returns first membership even if other orgs exist', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        membershipRowArb,
        (user, firstMembership, secondMembership) => {
          fc.pre(
            firstMembership.organizations !== null &&
            secondMembership.organizations !== null &&
            firstMembership.organizations.id !== secondMembership.organizations.id
          )

          const memberships = [firstMembership, secondMembership]

          const result = resolveActiveOrgSync(user, undefined, memberships)

          expect(result).not.toBeNull()
          expect(result!.org.id).toBe(firstMembership.organizations!.id)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('V13: Org Context — Consistency Properties', () => {
  test('resolution is deterministic (same inputs => same output)', () => {
    fc.assert(
      fc.property(
        fc.option(userArb, { nil: null }),
        fc.option(uuidArb, { nil: undefined }),
        fc.array(membershipRowArb, { maxLength: 5 }),
        (user, savedOrgId, memberships) => {
          const r1 = resolveActiveOrgSync(user, savedOrgId, memberships)
          const r2 = resolveActiveOrgSync(user, savedOrgId, memberships)
          expect(r1).toEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('result is always null or a valid OrgContext', () => {
    fc.assert(
      fc.property(
        fc.option(userArb, { nil: null }),
        fc.option(uuidArb, { nil: undefined }),
        fc.array(membershipRowArb, { maxLength: 5 }),
        (user, savedOrgId, memberships) => {
          const result = resolveActiveOrgSync(user, savedOrgId, memberships)
          if (result !== null) {
            expect(result.org).toBeDefined()
            expect(result.role).toBeDefined()
            expect(typeof result.org.id).toBe('string')
            expect(typeof result.org.name).toBe('string')
            expect(typeof result.org.slug).toBe('string')
            expect(ALL_ROLES).toContain(result.role)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('non-null result only when user exists and at least one valid membership', () => {
    fc.assert(
      fc.property(
        fc.option(userArb, { nil: null }),
        fc.option(uuidArb, { nil: undefined }),
        fc.array(membershipRowArb, { maxLength: 5 }),
        (user, savedOrgId, memberships) => {
          const result = resolveActiveOrgSync(user, savedOrgId, memberships)
          if (result !== null) {
            // User must exist
            expect(user).not.toBeNull()
            // At least one membership with a non-null organization must exist
            const hasValidMembership = memberships.some(
              (m) => m.organizations !== null
            )
            expect(hasValidMembership).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('returned org always comes from the membership list', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.option(uuidArb, { nil: undefined }),
        fc.array(membershipRowArb, { minLength: 1, maxLength: 5 }),
        (user, savedOrgId, memberships) => {
          const result = resolveActiveOrgSync(user, savedOrgId, memberships)
          if (result !== null) {
            const orgIds = memberships
              .filter((m) => m.organizations !== null)
              .map((m) => m.organizations!.id)
            expect(orgIds).toContain(result.org.id)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

describe('V13: Org Context — Edge Cases', () => {
  test('empty string savedOrgId behaves like undefined (falsy)', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.array(membershipRowArb, { minLength: 1, maxLength: 3 }),
        (user, memberships) => {
          // Empty string is falsy, so it should behave same as undefined
          const withEmpty = resolveActiveOrgSync(user, '', memberships)
          const withUndefined = resolveActiveOrgSync(user, undefined, memberships)
          expect(withEmpty).toEqual(withUndefined)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('savedOrgId matching first membership returns same as no cookie', () => {
    fc.assert(
      fc.property(
        userArb,
        membershipRowArb,
        fc.array(membershipRowArb, { maxLength: 3 }),
        (user, firstMembership, rest) => {
          fc.pre(firstMembership.organizations !== null)

          const memberships = [firstMembership, ...rest]
          const matchingId = firstMembership.organizations!.id

          const withCookie = resolveActiveOrgSync(user, matchingId, memberships)
          const withoutCookie = resolveActiveOrgSync(user, undefined, memberships)

          // Both should resolve to the first membership's org
          expect(withCookie).not.toBeNull()
          expect(withCookie!.org.id).toBe(firstMembership.organizations!.id)
          // Without cookie also returns first
          expect(withoutCookie).not.toBeNull()
          expect(withoutCookie!.org.id).toBe(firstMembership.organizations!.id)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('all roles are preserved through resolution', () => {
    fc.assert(
      fc.property(
        userArb,
        organizationArb,
        roleArb,
        (user, org, role) => {
          const membership: MembershipRow = { role, organizations: org }
          const result = resolveActiveOrgSync(user, undefined, [membership])

          expect(result).not.toBeNull()
          expect(result!.role).toBe(role)
        }
      ),
      { numRuns: 100 }
    )
  })
})
