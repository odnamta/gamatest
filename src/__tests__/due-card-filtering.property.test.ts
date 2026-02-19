import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { filterDueCards, CardForDueCount } from '../lib/due-count';

/**
 * Due Card Filtering Property-Based Tests
 * 
 * **Feature: cekatan, Property 11: Due Card Filtering Correctness**
 * **Validates: Requirements 5.1**
 * 
 * For any deck and for any current timestamp, the set of due cards returned
 * SHALL contain exactly those cards where next_review <= current timestamp.
 */

// Generator for valid ISO date strings using timestamps to avoid invalid dates
const validDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-01-01').getTime(),
}).map(timestamp => new Date(timestamp).toISOString());

// Generator for a card with a next_review timestamp and an id for tracking
interface CardWithId extends CardForDueCount {
  id: string;
  next_review: string;
}

const cardWithIdArb: fc.Arbitrary<CardWithId> = fc.record({
  id: fc.uuid(),
  next_review: validDateArb,
});

// Generator for an array of cards
const cardsArb = fc.array(cardWithIdArb, { minLength: 0, maxLength: 100 });

describe('Property 11: Due Card Filtering Correctness', () => {
  /**
   * Core property: The filtered set contains EXACTLY the cards where next_review <= currentTime.
   * This means:
   * 1. Every card in the result has next_review <= currentTime
   * 2. Every card NOT in the result has next_review > currentTime
   */
  test('Filtered due cards contain exactly cards where next_review <= current time', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCards = filterDueCards(cards, currentTime);
        const dueCardIds = new Set(dueCards.map(c => c.id));
        
        // Check every card in the original array
        for (const card of cards) {
          const isDue = card.next_review <= currentTime;
          const isInResult = dueCardIds.has(card.id);
          
          // Card should be in result if and only if it's due
          expect(isInResult).toBe(isDue);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * All returned cards must have next_review <= currentTime
   */
  test('All returned cards have next_review <= current time', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCards = filterDueCards(cards, currentTime);
        
        for (const card of dueCards) {
          expect(card.next_review <= currentTime).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * No card with next_review > currentTime should be in the result
   */
  test('No cards with next_review > current time are returned', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCards = filterDueCards(cards, currentTime);
        
        for (const card of dueCards) {
          expect(card.next_review > currentTime).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * The count of due cards equals the count of cards where next_review <= currentTime
   */
  test('Due card count matches manual count of cards where next_review <= current time', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCards = filterDueCards(cards, currentTime);
        
        const manualCount = cards.filter(c => c.next_review <= currentTime).length;
        
        expect(dueCards.length).toBe(manualCount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: Empty input returns empty output
   */
  test('Empty card array returns empty due cards array', () => {
    fc.assert(
      fc.property(validDateArb, (currentTime) => {
        const dueCards = filterDueCards([], currentTime);
        
        expect(dueCards).toEqual([]);
        expect(dueCards.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: All cards due when current time is far in the future
   */
  test('All cards returned when current time is far in the future', () => {
    const farFutureTime = new Date('2099-12-31').toISOString();
    
    fc.assert(
      fc.property(cardsArb, (cards) => {
        const dueCards = filterDueCards(cards, farFutureTime);
        
        expect(dueCards.length).toBe(cards.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: No cards due when current time is far in the past
   */
  test('No cards returned when current time is far in the past', () => {
    const farPastTime = new Date('1990-01-01').toISOString();
    
    fc.assert(
      fc.property(cardsArb, (cards) => {
        const dueCards = filterDueCards(cards, farPastTime);
        
        expect(dueCards.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * The result preserves the original card objects (referential equality)
   */
  test('Filtered cards are the same objects as in the original array', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCards = filterDueCards(cards, currentTime);
        
        for (const dueCard of dueCards) {
          // The due card should be the exact same object from the original array
          const originalCard = cards.find(c => c.id === dueCard.id);
          expect(dueCard).toBe(originalCard);
        }
      }),
      { numRuns: 100 }
    );
  });
});
