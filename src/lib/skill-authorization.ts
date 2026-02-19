/**
 * V19: Skill Domain Authorization
 * Pure functions for skill-related permission checks.
 */

import type { OrgRole } from '@/types/database'
import { hasMinimumRole } from './org-authorization'

/**
 * Can the user manage skill domains (create/update/delete)?
 * Requires admin+ role.
 */
export function canManageSkillDomains(role: OrgRole): boolean {
  return hasMinimumRole(role, 'admin')
}

/**
 * Can the user link decks to skill domains?
 * Requires creator+ role.
 */
export function canLinkDeckToSkill(role: OrgRole): boolean {
  return hasMinimumRole(role, 'creator')
}

/**
 * Can the user view skill scores?
 * All members can view their own scores.
 * Admins+ can view all org scores (heatmap).
 */
export function canViewOrgSkillScores(role: OrgRole): boolean {
  return hasMinimumRole(role, 'admin')
}

/**
 * Can the user view their own skill scores?
 * All members can, but respects org visibility setting.
 */
export function canViewOwnSkillScores(
  role: OrgRole,
  skillsVisibleToCandidates: boolean = true
): boolean {
  if (hasMinimumRole(role, 'admin')) return true
  return skillsVisibleToCandidates
}
