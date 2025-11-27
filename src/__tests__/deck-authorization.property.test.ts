import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { checkDeckOwnership } from '../lib/deck-authorization';
import type { Deck } from '@/types/database';

/**
 * **Feature: cellines-obgyn-prep-v1, Property 11: Deck Ownership Authorization**
 * **Validates: Requirements 7.1**
 *
 * For any user attempting to access `/decks/[deckId]/add-bulk`, the page SHALL
 * only render if the user owns the deck; otherwise, redirect to dashboard.
 */
describe('Property 11: Deck Ownership Authorization', () => {
  // Generator for valid UUIDs
  const uuidArb = fc.uuid();

  // Generator for ISO date strings using integer timestamps to avoid invalid date issues
  const minTimestamp = new Date('2020-01-01').getTime();
  const maxTimestamp = new Date('2030-12-31').getTime();
  const isoDateArb = fc.integer({ min: minTimestamp, max: maxTimestamp })
    .map((ts) => new Date(ts).toISOString());

  // Generator for deck titles
  const titleArb = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for a valid Deck object
  const deckArb = fc.record({
    id: uuidArb,
    user_id: uuidArb,
    title: titleArb,
    created_at: isoDateArb,
  }) as fc.Arbitrary<Deck>;

  test('authorizes user when they own the deck', () => {
    fc.assert(
      fc.property(uuidArb, deckArb, (userId, deck) => {
        // Create a deck owned by the user
        const ownedDeck: Deck = { ...deck, user_id: userId };
        
        const result = checkDeckOwnership(userId, ownedDeck);
        
        expect(result.authorized).toBe(true);
        expect(result.reason).toBe('authorized');
      }),
      { numRuns: 100 }
    );
  });

  test('denies access when user does not own the deck', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, deckArb, (userId, otherUserId, deck) => {
        // Ensure the user IDs are different
        fc.pre(userId !== otherUserId);
        
        // Create a deck owned by another user
        const otherUserDeck: Deck = { ...deck, user_id: otherUserId };
        
        const result = checkDeckOwnership(userId, otherUserDeck);
        
        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('not_owner');
      }),
      { numRuns: 100 }
    );
  });

  test('denies access when user is not authenticated', () => {
    fc.assert(
      fc.property(deckArb, (deck) => {
        const result = checkDeckOwnership(null, deck);
        
        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('no_user');
      }),
      { numRuns: 100 }
    );
  });

  test('denies access when deck is not found', () => {
    fc.assert(
      fc.property(uuidArb, (userId) => {
        const result = checkDeckOwnership(userId, null);
        
        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('deck_not_found');
      }),
      { numRuns: 100 }
    );
  });

  test('authorization is symmetric: same user+deck always gives same result', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(deckArb, { nil: null }),
        (userId, deck) => {
          const result1 = checkDeckOwnership(userId, deck);
          const result2 = checkDeckOwnership(userId, deck);
          
          expect(result1.authorized).toBe(result2.authorized);
          expect(result1.reason).toBe(result2.reason);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('only the deck owner is authorized', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, deckArb, (userId1, userId2, baseDeck) => {
        // Create a deck owned by userId1
        const deck: Deck = { ...baseDeck, user_id: userId1 };
        
        const result1 = checkDeckOwnership(userId1, deck);
        const result2 = checkDeckOwnership(userId2, deck);
        
        // Owner should be authorized
        expect(result1.authorized).toBe(true);
        
        // Non-owner should only be authorized if they happen to be the same user
        if (userId1 === userId2) {
          expect(result2.authorized).toBe(true);
        } else {
          expect(result2.authorized).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});
