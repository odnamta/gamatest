/**
 * @deprecated This file is effectively unused in production code.
 * Only referenced by onboarding-v10.5.property.test.ts.
 * Safe to remove once that test file is cleaned up.
 *
 * Onboarding Constants and Helpers
 * V10.5: Brand Unification & Starter Packs
 *
 * Separated from server actions to avoid Next.js build errors.
 * Server Actions must be async, so synchronous helpers live here.
 */

/**
 * Starter pack configuration by specialty.
 * For V1, we query public decks dynamically rather than hardcoding IDs.
 * 
 * Requirements: 4.1
 */
export const SUPPORTED_SPECIALTIES = ['General'] as const
export type SupportedSpecialty = typeof SUPPORTED_SPECIALTIES[number]

/**
 * Checks if a specialty is supported for starter pack enrollment.
 * Used for property testing.
 * 
 * @param specialty - The specialty to check
 * @returns true if the specialty has a starter pack
 */
export function isSupportedSpecialty(specialty: string): specialty is SupportedSpecialty {
  return SUPPORTED_SPECIALTIES.includes(specialty as SupportedSpecialty)
}
