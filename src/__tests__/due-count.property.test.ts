import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { calculateDueCount, filterDueCards, CardForDueCount } from '../lib/due-count';

/**
 * Due Count Calculation Property-Based Tests
 * 
 * These tests verify the correctness properties of due count calculation
 * as specified in the design document.
 */

// Generator for valid ISO date strings using timestamps to avoid invalid dates
const validDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-01-01').getTime(),
}).map(timestamp => new Date(timestamp).toISOString());

// Generator for a card with a next_review timestamp
const cardArb: fc.Arbitrary<CardForDueCount> = fc.record({
  next_review: validDateArb,
});

// Generator for an array of cards
const cardsArb = fc.array(cardArb, { minLength: 0, maxLength: 100 });

/**
 * **Feature: cekatan, Property 12: Due Count Calculation Correctness**
 * **Validates: Requirements 6.2**
 * 
 * For any deck displayed on the dashboard, the due_count SHALL equal the count
 * of cards in that deck where next_review <= current timestamp.
 */
describe('Property 12: Due Count Calculation Correctness', () => {
  test('Due count equals count of cards where next_review <= current time', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCount = calculateDueCount(cards, currentTime);
        
        // Manually count cards that are due
        const expectedCount = cards.reduce((count, card) => {
          return card.next_review <= currentTime ? count + 1 : count;
        }, 0);
        
        expect(dueCount).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  test('Due count is always non-negative', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCount = calculateDueCount(cards, currentTime);
        
        expect(dueCount).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Due count is at most the total number of cards', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCount = calculateDueCount(cards, currentTime);
        
        expect(dueCount).toBeLessThanOrEqual(cards.length);
      }),
      { numRuns: 100 }
    );
  });

  test('Empty card array returns zero due count', () => {
    fc.assert(
      fc.property(validDateArb, (currentTime) => {
        const dueCount = calculateDueCount([], currentTime);
        
        expect(dueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('All cards due when current time is far in the future', () => {
    const farFutureTime = new Date('2099-12-31').toISOString();
    
    fc.assert(
      fc.property(cardsArb, (cards) => {
        const dueCount = calculateDueCount(cards, farFutureTime);
        
        expect(dueCount).toBe(cards.length);
      }),
      { numRuns: 100 }
    );
  });

  test('No cards due when current time is far in the past', () => {
    const farPastTime = new Date('1990-01-01').toISOString();
    
    fc.assert(
      fc.property(cardsArb, (cards) => {
        const dueCount = calculateDueCount(cards, farPastTime);
        
        expect(dueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Due count matches filtered due cards length', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCount = calculateDueCount(cards, currentTime);
        const dueCards = filterDueCards(cards, currentTime);
        
        expect(dueCount).toBe(dueCards.length);
      }),
      { numRuns: 100 }
    );
  });

  test('All filtered due cards have next_review <= current time', () => {
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

  test('Cards not in filtered due cards have next_review > current time', () => {
    fc.assert(
      fc.property(cardsArb, validDateArb, (cards, currentTime) => {
        const dueCards = filterDueCards(cards, currentTime);
        const dueCardSet = new Set(dueCards.map(c => c.next_review));
        
        for (const card of cards) {
          if (!dueCardSet.has(card.next_review) || !dueCards.includes(card)) {
            // If card is not in due cards, its next_review should be > currentTime
            const isInDueCards = dueCards.some(dc => dc === card);
            if (!isInDueCards) {
              expect(card.next_review > currentTime).toBe(true);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
