import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  updateSessionState,
  applyRatings,
  initialSessionState,
} from '../lib/session-state';
import type { SessionState } from '../types/session';

/**
 * Session State Property-Based Tests
 * 
 * These tests verify the correctness properties of the session tracking system
 * as specified in the design document.
 */

// Generator for valid ratings (1=again, 2=hard, 3=good, 4=easy)
const ratingArb = fc.constantFrom(1, 2, 3, 4) as fc.Arbitrary<1 | 2 | 3 | 4>;

// Generator for sequences of ratings
const ratingSequenceArb = fc.array(ratingArb, { minLength: 1, maxLength: 50 });

// Generator for valid session state
const sessionStateArb = fc.record({
  cardsReviewed: fc.integer({ min: 0, max: 1000 }),
  ratings: fc.record({
    again: fc.integer({ min: 0, max: 250 }),
    hard: fc.integer({ min: 0, max: 250 }),
    good: fc.integer({ min: 0, max: 250 }),
    easy: fc.integer({ min: 0, max: 250 }),
  }),
});

/**
 * **Feature: cellines-obgyn-prep-v1, Property 6: Session Tracking Accuracy**
 * **Validates: Requirements 3.1, 3.2**
 * 
 * For any study session with a sequence of ratings, the session summary SHALL report:
 * - `totalReviewed` equal to the count of ratings given
 * - `ratingBreakdown` counts matching the actual ratings (again=1, hard=2, good=3, easy=4)
 */
describe('Property 6: Session Tracking Accuracy', () => {
  test('totalReviewed equals the count of ratings given', () => {
    fc.assert(
      fc.property(ratingSequenceArb, (ratings) => {
        const result = applyRatings(ratings);
        
        expect(result.cardsReviewed).toBe(ratings.length);
      }),
      { numRuns: 100 }
    );
  });

  test('ratingBreakdown counts match actual ratings', () => {
    fc.assert(
      fc.property(ratingSequenceArb, (ratings) => {
        const result = applyRatings(ratings);
        
        // Count expected ratings
        const expectedAgain = ratings.filter(r => r === 1).length;
        const expectedHard = ratings.filter(r => r === 2).length;
        const expectedGood = ratings.filter(r => r === 3).length;
        const expectedEasy = ratings.filter(r => r === 4).length;
        
        expect(result.ratings.again).toBe(expectedAgain);
        expect(result.ratings.hard).toBe(expectedHard);
        expect(result.ratings.good).toBe(expectedGood);
        expect(result.ratings.easy).toBe(expectedEasy);
      }),
      { numRuns: 100 }
    );
  });

  test('sum of rating breakdown equals totalReviewed', () => {
    fc.assert(
      fc.property(ratingSequenceArb, (ratings) => {
        const result = applyRatings(ratings);
        
        const sumOfRatings = 
          result.ratings.again + 
          result.ratings.hard + 
          result.ratings.good + 
          result.ratings.easy;
        
        expect(sumOfRatings).toBe(result.cardsReviewed);
      }),
      { numRuns: 100 }
    );
  });

  test('single rating updates state correctly', () => {
    fc.assert(
      fc.property(sessionStateArb, ratingArb, (state, rating) => {
        const result = updateSessionState(state, rating);
        
        // cardsReviewed should increase by 1
        expect(result.cardsReviewed).toBe(state.cardsReviewed + 1);
        
        // Only the corresponding rating count should increase
        const ratingKey = rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy';
        
        expect(result.ratings[ratingKey]).toBe(state.ratings[ratingKey] + 1);
        
        // Other ratings should remain unchanged
        const otherKeys = (['again', 'hard', 'good', 'easy'] as const).filter(k => k !== ratingKey);
        for (const key of otherKeys) {
          expect(result.ratings[key]).toBe(state.ratings[key]);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('initial state has zero counts', () => {
    expect(initialSessionState.cardsReviewed).toBe(0);
    expect(initialSessionState.ratings.again).toBe(0);
    expect(initialSessionState.ratings.hard).toBe(0);
    expect(initialSessionState.ratings.good).toBe(0);
    expect(initialSessionState.ratings.easy).toBe(0);
  });

  test('rating breakdown is non-negative after any sequence', () => {
    fc.assert(
      fc.property(ratingSequenceArb, (ratings) => {
        const result = applyRatings(ratings);
        
        expect(result.cardsReviewed).toBeGreaterThanOrEqual(0);
        expect(result.ratings.again).toBeGreaterThanOrEqual(0);
        expect(result.ratings.hard).toBeGreaterThanOrEqual(0);
        expect(result.ratings.good).toBeGreaterThanOrEqual(0);
        expect(result.ratings.easy).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });
});
