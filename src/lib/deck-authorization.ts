/**
 * Deck Authorization Helper
 * Pure functions for verifying deck ownership.
 * Requirements: 7.1
 */

import type { Deck } from '@/types/database';

export interface AuthorizationResult {
  authorized: boolean;
  reason: 'authorized' | 'no_user' | 'deck_not_found' | 'not_owner';
}

/**
 * Checks if a user is authorized to access a deck.
 * 
 * @param userId - The ID of the user attempting access (null if not authenticated)
 * @param deck - The deck being accessed (null if not found)
 * @returns Authorization result with reason
 * 
 * Requirements: 7.1 - Verify user owns deck before rendering
 */
export function checkDeckOwnership(
  userId: string | null,
  deck: Deck | null
): AuthorizationResult {
  // No authenticated user
  if (!userId) {
    return { authorized: false, reason: 'no_user' };
  }

  // Deck not found
  if (!deck) {
    return { authorized: false, reason: 'deck_not_found' };
  }

  // User doesn't own the deck
  if (deck.user_id !== userId) {
    return { authorized: false, reason: 'not_owner' };
  }

  // User owns the deck
  return { authorized: true, reason: 'authorized' };
}
