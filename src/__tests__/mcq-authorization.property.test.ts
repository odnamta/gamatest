import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { checkMCQDeckOwnership } from '../lib/mcq-authorization';
import type { Deck } from '@/types/database';

/**
 * **Feature: cekatan, Property 3: MCQ Deck Authorization**
 * **Validates: Requirements 1.3, 3.4**
 *
 * For any user and for any deck, the user SHALL only be able to create, read,
 * update, or delete MCQs in decks they own.
 */
describe('Property 3: MCQ Deck Authorization', () => {
  // Generator for valid UUIDs
  const uuidArb = fc.uuid();

  // Generator for ISO date strings using integer timestamps
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

  test('authorizes MCQ operations when user owns the deck', () => {
    fc.assert(
      fc.property(uuidArb, deckArb, (userId, deck) => {
        // Create a deck owned by the user
        const ownedDeck: Deck = { ...deck, user_id: userId };

        const result = checkMCQDeckOwnership(userId, ownedDeck);

        expect(result.authorized).toBe(true);
        expect(result.reason).toBe('authorized');
      }),
      { numRuns: 100 }
    );
  });

  test('denies MCQ operations when user does not own the deck', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, deckArb, (userId, otherUserId, deck) => {
        // Ensure the user IDs are different
        fc.pre(userId !== otherUserId);

        // Create a deck owned by another user
        const otherUserDeck: Deck = { ...deck, user_id: otherUserId };

        const result = checkMCQDeckOwnership(userId, otherUserDeck);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('not_owner');
      }),
      { numRuns: 100 }
    );
  });

  test('denies MCQ operations when user is not authenticated', () => {
    fc.assert(
      fc.property(deckArb, (deck) => {
        const result = checkMCQDeckOwnership(null, deck);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('no_user');
      }),
      { numRuns: 100 }
    );
  });

  test('denies MCQ operations when deck is not found', () => {
    fc.assert(
      fc.property(uuidArb, (userId) => {
        const result = checkMCQDeckOwnership(userId, null);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('deck_not_found');
      }),
      { numRuns: 100 }
    );
  });

  test('MCQ authorization is deterministic: same inputs always give same result', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(deckArb, { nil: null }),
        (userId, deck) => {
          const result1 = checkMCQDeckOwnership(userId, deck);
          const result2 = checkMCQDeckOwnership(userId, deck);

          expect(result1.authorized).toBe(result2.authorized);
          expect(result1.reason).toBe(result2.reason);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('only the deck owner can perform MCQ operations', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, deckArb, (userId1, userId2, baseDeck) => {
        // Create a deck owned by userId1
        const deck: Deck = { ...baseDeck, user_id: userId1 };

        const result1 = checkMCQDeckOwnership(userId1, deck);
        const result2 = checkMCQDeckOwnership(userId2, deck);

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

  test('authorization result reason matches authorization status', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(deckArb, { nil: null }),
        (userId, deck) => {
          const result = checkMCQDeckOwnership(userId, deck);

          if (result.authorized) {
            expect(result.reason).toBe('authorized');
          } else {
            expect(['no_user', 'deck_not_found', 'not_owner']).toContain(result.reason);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
