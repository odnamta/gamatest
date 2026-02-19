import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateNextReview,
  serializeCardState,
  deserializeCardState,
  SM2Input,
  CardState,
} from '../lib/sm2';

/**
 * SM-2 Algorithm Property-Based Tests
 * 
 * These tests verify the correctness properties of the SM-2 spaced repetition algorithm
 * as specified in the design document.
 */

// Generator for valid SM-2 inputs
const validIntervalArb = fc.integer({ min: 0, max: 365 });
// Use integer-based generation to avoid floating-point precision issues
// Generate values from 130 to 400 (representing 1.30 to 4.00) then divide by 100
const validEaseFactorArb = fc.integer({ min: 130, max: 400 }).map(n => n / 100);
const validRatingArb = fc.constantFrom(1, 2, 3, 4) as fc.Arbitrary<1 | 2 | 3 | 4>;

const sm2InputArb = fc.record({
  interval: validIntervalArb,
  easeFactor: validEaseFactorArb,
  rating: validRatingArb,
});

// Generator for valid dates (using timestamps to avoid NaN dates)
const validDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-01-01').getTime(),
}).map(timestamp => new Date(timestamp));

// Generator for card state (for serialization tests)
const cardStateArb: fc.Arbitrary<CardState> = fc.record({
  interval: validIntervalArb,
  easeFactor: validEaseFactorArb,
  nextReview: validDateArb,
});

/**
 * **Feature: cekatan, Property 1: SM-2 "Again" Rating Resets Interval**
 * **Validates: Requirements 4.1, V8.2 1.1**
 * 
 * For any card with any interval and ease factor, when rated as "Again" (1),
 * the resulting interval SHALL be 0 and the next review SHALL be approximately
 * 10 minutes from the current time (to prevent Groundhog Day bug).
 */
describe('Property 1: SM-2 "Again" Rating Resets Interval', () => {
  test('Again rating always resets interval to 0', () => {
    fc.assert(
      fc.property(validIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const input: SM2Input = { interval, easeFactor, rating: 1 };
        const result = calculateNextReview(input);
        
        expect(result.interval).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Again rating sets next review to approximately 10 minutes from now', () => {
    fc.assert(
      fc.property(validIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const before = Date.now();
        const input: SM2Input = { interval, easeFactor, rating: 1 };
        const result = calculateNextReview(input);
        const after = Date.now();
        
        // V8.2: Changed from 1 minute to 10 minutes to fix Groundhog Day bug
        const expectedMinTime = before + 10 * 60 * 1000;
        const expectedMaxTime = after + 10 * 60 * 1000;
        
        expect(result.nextReview.getTime()).toBeGreaterThanOrEqual(expectedMinTime);
        expect(result.nextReview.getTime()).toBeLessThanOrEqual(expectedMaxTime);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cekatan, Property 2: SM-2 "Hard" Rating Multiplies Interval**
 * **Validates: Requirements 4.2**
 * 
 * For any card with interval > 0 and any valid ease factor, when rated as "Hard" (2),
 * the resulting interval SHALL be approximately interval × 1.2 (rounded), and the
 * ease factor SHALL decrease but remain >= 1.3.
 */
describe('Property 2: SM-2 "Hard" Rating Multiplies Interval', () => {
  // Generator for intervals > 0
  const positiveIntervalArb = fc.integer({ min: 1, max: 365 });

  test('Hard rating multiplies interval by 1.2 (rounded)', () => {
    fc.assert(
      fc.property(positiveIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const input: SM2Input = { interval, easeFactor, rating: 2 };
        const result = calculateNextReview(input);
        
        const expectedInterval = Math.max(1, Math.round(interval * 1.2));
        expect(result.interval).toBe(expectedInterval);
      }),
      { numRuns: 100 }
    );
  });

  test('Hard rating decreases ease factor but keeps it >= 1.3', () => {
    fc.assert(
      fc.property(positiveIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const input: SM2Input = { interval, easeFactor, rating: 2 };
        const result = calculateNextReview(input);
        
        // Ease factor should decrease by 0.15 but not below 1.3
        const expectedEaseFactor = Math.max(1.3, easeFactor - 0.15);
        expect(result.easeFactor).toBeCloseTo(expectedEaseFactor, 5);
        expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
      }),
      { numRuns: 100 }
    );
  });

  test('Hard rating with interval 0 sets interval to 1', () => {
    fc.assert(
      fc.property(validEaseFactorArb, (easeFactor) => {
        const input: SM2Input = { interval: 0, easeFactor, rating: 2 };
        const result = calculateNextReview(input);
        
        expect(result.interval).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cekatan, Property 3: SM-2 "Good" Rating Uses Ease Factor**
 * **Validates: Requirements 4.3**
 * 
 * For any card with interval > 0 and any valid ease factor, when rated as "Good" (3),
 * the resulting interval SHALL be approximately interval × ease_factor (rounded),
 * and the ease factor SHALL remain unchanged.
 */
describe('Property 3: SM-2 "Good" Rating Uses Ease Factor', () => {
  // Generator for intervals > 0
  const positiveIntervalArb = fc.integer({ min: 1, max: 365 });

  test('Good rating multiplies interval by ease factor (rounded)', () => {
    fc.assert(
      fc.property(positiveIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const input: SM2Input = { interval, easeFactor, rating: 3 };
        const result = calculateNextReview(input);
        
        const expectedInterval = Math.round(interval * easeFactor);
        expect(result.interval).toBe(expectedInterval);
      }),
      { numRuns: 100 }
    );
  });

  test('Good rating keeps ease factor unchanged', () => {
    fc.assert(
      fc.property(positiveIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const input: SM2Input = { interval, easeFactor, rating: 3 };
        const result = calculateNextReview(input);
        
        expect(result.easeFactor).toBeCloseTo(easeFactor, 5);
      }),
      { numRuns: 100 }
    );
  });

  test('Good rating with interval 0 sets interval to 1', () => {
    fc.assert(
      fc.property(validEaseFactorArb, (easeFactor) => {
        const input: SM2Input = { interval: 0, easeFactor, rating: 3 };
        const result = calculateNextReview(input);
        
        expect(result.interval).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cekatan, Property 4: SM-2 "Easy" Rating Increases Interval and Ease**
 * **Validates: Requirements 4.4**
 * 
 * For any card with interval > 0 and any valid ease factor, when rated as "Easy" (4),
 * the resulting interval SHALL be approximately interval × (ease_factor + 0.15) (rounded),
 * and the ease factor SHALL increase by 0.15.
 */
describe('Property 4: SM-2 "Easy" Rating Increases Interval and Ease', () => {
  // Generator for intervals > 0
  const positiveIntervalArb = fc.integer({ min: 1, max: 365 });

  test('Easy rating multiplies interval by (ease factor + 0.15) (rounded)', () => {
    fc.assert(
      fc.property(positiveIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const input: SM2Input = { interval, easeFactor, rating: 4 };
        const result = calculateNextReview(input);
        
        const expectedInterval = Math.round(interval * (easeFactor + 0.15));
        expect(result.interval).toBe(expectedInterval);
      }),
      { numRuns: 100 }
    );
  });

  test('Easy rating increases ease factor by 0.15', () => {
    fc.assert(
      fc.property(positiveIntervalArb, validEaseFactorArb, (interval, easeFactor) => {
        const input: SM2Input = { interval, easeFactor, rating: 4 };
        const result = calculateNextReview(input);
        
        const expectedEaseFactor = easeFactor + 0.15;
        expect(result.easeFactor).toBeCloseTo(expectedEaseFactor, 5);
      }),
      { numRuns: 100 }
    );
  });

  test('Easy rating with interval 0 sets interval to 4', () => {
    fc.assert(
      fc.property(validEaseFactorArb, (easeFactor) => {
        const input: SM2Input = { interval: 0, easeFactor, rating: 4 };
        const result = calculateNextReview(input);
        
        expect(result.interval).toBe(4);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cekatan, Property 5: Ease Factor Minimum Invariant**
 * **Validates: Requirements 4.5**
 * 
 * For any card and for any sequence of ratings applied to that card,
 * the ease factor SHALL never fall below 1.3.
 */
describe('Property 5: Ease Factor Minimum Invariant', () => {
  // Generator for a sequence of ratings
  const ratingSequenceArb = fc.array(validRatingArb, { minLength: 1, maxLength: 50 });

  test('Ease factor never falls below 1.3 after any single rating', () => {
    fc.assert(
      fc.property(validIntervalArb, validEaseFactorArb, validRatingArb, (interval, easeFactor, rating) => {
        const input: SM2Input = { interval, easeFactor, rating };
        const result = calculateNextReview(input);
        
        expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
      }),
      { numRuns: 100 }
    );
  });

  test('Ease factor never falls below 1.3 after a sequence of ratings', () => {
    fc.assert(
      fc.property(validIntervalArb, validEaseFactorArb, ratingSequenceArb, (initialInterval, initialEaseFactor, ratings) => {
        let currentInterval = initialInterval;
        let currentEaseFactor = initialEaseFactor;
        
        for (const rating of ratings) {
          const input: SM2Input = { interval: currentInterval, easeFactor: currentEaseFactor, rating };
          const result = calculateNextReview(input);
          
          // Check invariant after each rating
          expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
          
          // Update state for next iteration
          currentInterval = result.interval;
          currentEaseFactor = result.easeFactor;
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Ease factor stays at 1.3 when already at minimum and receiving "Again" or "Hard"', () => {
    fc.assert(
      fc.property(validIntervalArb, fc.constantFrom(1, 2) as fc.Arbitrary<1 | 2>, (interval, rating) => {
        const input: SM2Input = { interval, easeFactor: 1.3, rating };
        const result = calculateNextReview(input);
        
        expect(result.easeFactor).toBeCloseTo(1.3, 5);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cekatan, Property 6: Card State Serialization Round-Trip**
 * **Validates: Requirements 4.6**
 * 
 * For any valid card state (interval, ease factor, next review date),
 * serializing to JSON and deserializing back SHALL produce an equivalent card state.
 */
describe('Property 6: Card State Serialization Round-Trip', () => {
  test('Serializing and deserializing produces equivalent card state', () => {
    fc.assert(
      fc.property(cardStateArb, (cardState) => {
        const serialized = serializeCardState(cardState);
        const deserialized = deserializeCardState(serialized);
        
        expect(deserialized.interval).toBe(cardState.interval);
        expect(deserialized.easeFactor).toBeCloseTo(cardState.easeFactor, 5);
        expect(deserialized.nextReview.getTime()).toBe(cardState.nextReview.getTime());
      }),
      { numRuns: 100 }
    );
  });

  test('Serialized output is valid JSON', () => {
    fc.assert(
      fc.property(cardStateArb, (cardState) => {
        const serialized = serializeCardState(cardState);
        
        // Should not throw when parsing
        expect(() => JSON.parse(serialized)).not.toThrow();
        
        // Should contain expected keys
        const parsed = JSON.parse(serialized);
        expect(parsed).toHaveProperty('interval');
        expect(parsed).toHaveProperty('easeFactor');
        expect(parsed).toHaveProperty('nextReview');
      }),
      { numRuns: 100 }
    );
  });

  test('Round-trip preserves data after SM-2 calculation', () => {
    fc.assert(
      fc.property(sm2InputArb, (input) => {
        const result = calculateNextReview(input);
        const cardState: CardState = {
          interval: result.interval,
          easeFactor: result.easeFactor,
          nextReview: result.nextReview,
        };
        
        const serialized = serializeCardState(cardState);
        const deserialized = deserializeCardState(serialized);
        
        expect(deserialized.interval).toBe(cardState.interval);
        expect(deserialized.easeFactor).toBeCloseTo(cardState.easeFactor, 5);
        expect(deserialized.nextReview.getTime()).toBe(cardState.nextReview.getTime());
      }),
      { numRuns: 100 }
    );
  });
});
