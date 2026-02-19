import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  checkSourceOwnership,
  checkDeckSourceOwnership,
  checkSourceFileAccess,
} from '../lib/source-authorization';
import type { Source, DeckSource, Deck } from '@/types/database';

/**
 * **Feature: cekatan, Property 13: Source Access Control**
 * **Validates: Requirements 8.2, 9.5**
 *
 * For any user:
 * - The user SHALL only see sources where user_id matches their auth.uid()
 * - The user SHALL NOT be able to access another user's PDF file via direct URL
 */
describe('Property 13: Source Access Control', () => {
  // Generator for valid UUIDs
  const uuidArb = fc.uuid();

  // Generator for ISO date strings
  const minTimestamp = new Date('2020-01-01').getTime();
  const maxTimestamp = new Date('2030-12-31').getTime();
  const isoDateArb = fc
    .integer({ min: minTimestamp, max: maxTimestamp })
    .map((ts) => new Date(ts).toISOString());

  // Generator for titles
  const titleArb = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for file URLs
  const fileUrlArb = fc.webUrl();

  // Generator for Source
  const sourceArb = fc.record({
    id: uuidArb,
    user_id: uuidArb,
    title: titleArb,
    type: fc.constantFrom('pdf_book', 'pdf_notes', 'document'),
    file_url: fileUrlArb,
    metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<Source>;

  // Generator for Deck
  const deckArb = fc.record({
    id: uuidArb,
    user_id: uuidArb,
    title: titleArb,
    created_at: isoDateArb,
  }) as fc.Arbitrary<Deck>;

  // Generator for DeckSource
  const deckSourceArb = fc.record({
    id: uuidArb,
    deck_id: uuidArb,
    source_id: uuidArb,
    created_at: isoDateArb,
  }) as fc.Arbitrary<DeckSource>;

  describe('Source Ownership (Requirements 8.2)', () => {
    test('authorizes source access when user owns the source', () => {
      fc.assert(
        fc.property(uuidArb, sourceArb, (userId, source) => {
          const ownedSource: Source = { ...source, user_id: userId };
          const result = checkSourceOwnership(userId, ownedSource);

          expect(result.authorized).toBe(true);
          expect(result.reason).toBe('authorized');
        }),
        { numRuns: 100 }
      );
    });

    test('denies source access when user does not own the source', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, sourceArb, (userId, otherUserId, source) => {
          fc.pre(userId !== otherUserId);
          const otherUserSource: Source = { ...source, user_id: otherUserId };
          const result = checkSourceOwnership(userId, otherUserSource);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_owner');
        }),
        { numRuns: 100 }
      );
    });

    test('denies source access when user is not authenticated', () => {
      fc.assert(
        fc.property(sourceArb, (source) => {
          const result = checkSourceOwnership(null, source);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('no_user');
        }),
        { numRuns: 100 }
      );
    });

    test('denies source access when source is not found', () => {
      fc.assert(
        fc.property(uuidArb, (userId) => {
          const result = checkSourceOwnership(userId, null);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('source_not_found');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('PDF File Access (Requirements 9.5)', () => {
    test('authorizes file access when user owns the source', () => {
      fc.assert(
        fc.property(uuidArb, sourceArb, (userId, source) => {
          const ownedSource: Source = { ...source, user_id: userId };
          const result = checkSourceFileAccess(userId, ownedSource);

          expect(result.authorized).toBe(true);
          expect(result.reason).toBe('authorized');
        }),
        { numRuns: 100 }
      );
    });

    test('denies file access when user does not own the source', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, sourceArb, (userId, otherUserId, source) => {
          fc.pre(userId !== otherUserId);
          const otherUserSource: Source = { ...source, user_id: otherUserId };
          const result = checkSourceFileAccess(userId, otherUserSource);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_owner');
        }),
        { numRuns: 100 }
      );
    });

    test('denies file access when user is not authenticated', () => {
      fc.assert(
        fc.property(sourceArb, (source) => {
          const result = checkSourceFileAccess(null, source);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('no_user');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('DeckSource Access Control', () => {
    test('authorizes deck_source access when user owns the deck', () => {
      fc.assert(
        fc.property(uuidArb, deckArb, deckSourceArb, (userId, deck, deckSource) => {
          const ownedDeck: Deck = { ...deck, user_id: userId };
          const linkedDeckSource: DeckSource = { ...deckSource, deck_id: ownedDeck.id };
          const result = checkDeckSourceOwnership(userId, linkedDeckSource, ownedDeck);

          expect(result.authorized).toBe(true);
          expect(result.reason).toBe('authorized');
        }),
        { numRuns: 100 }
      );
    });

    test('denies deck_source access when user does not own the deck', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, deckArb, deckSourceArb, (userId, otherUserId, deck, deckSource) => {
          fc.pre(userId !== otherUserId);
          const otherUserDeck: Deck = { ...deck, user_id: otherUserId };
          const linkedDeckSource: DeckSource = { ...deckSource, deck_id: otherUserDeck.id };
          const result = checkDeckSourceOwnership(userId, linkedDeckSource, otherUserDeck);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_owner');
        }),
        { numRuns: 100 }
      );
    });

    test('denies deck_source access when deck_source is not linked to the deck', () => {
      fc.assert(
        fc.property(uuidArb, deckArb, deckSourceArb, (userId, deck, deckSource) => {
          const ownedDeck: Deck = { ...deck, user_id: userId };
          // DeckSource has a different deck_id
          fc.pre(deckSource.deck_id !== ownedDeck.id);
          const result = checkDeckSourceOwnership(userId, deckSource, ownedDeck);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_found');
        }),
        { numRuns: 100 }
      );
    });

    test('denies deck_source access when user is not authenticated', () => {
      fc.assert(
        fc.property(deckArb, deckSourceArb, (deck, deckSource) => {
          const linkedDeckSource: DeckSource = { ...deckSource, deck_id: deck.id };
          const result = checkDeckSourceOwnership(null, linkedDeckSource, deck);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('no_user');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Authorization Consistency', () => {
    test('authorization is deterministic: same inputs always give same result', () => {
      fc.assert(
        fc.property(
          fc.option(uuidArb, { nil: null }),
          fc.option(sourceArb, { nil: null }),
          (userId, source) => {
            const result1 = checkSourceOwnership(userId, source);
            const result2 = checkSourceOwnership(userId, source);

            expect(result1.authorized).toBe(result2.authorized);
            expect(result1.reason).toBe(result2.reason);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('only the source owner is authorized', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, sourceArb, (userId1, userId2, baseSource) => {
          // Create a source owned by userId1
          const source: Source = { ...baseSource, user_id: userId1 };

          const result1 = checkSourceOwnership(userId1, source);
          const result2 = checkSourceOwnership(userId2, source);

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
});
