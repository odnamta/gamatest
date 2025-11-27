import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateStreak,
  updateLongestStreak,
  incrementTotalReviews,
  StreakInput,
} from '../lib/streak';
import { addDays, startOfDay } from 'date-fns';

/**
 * Streak Calculator Property-Based Tests
 * 
 * These tests verify the correctness properties of the streak calculation system
 * as specified in the design document.
 */

// Generator for valid dates (using timestamps to avoid NaN dates)
const validDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-01-01').getTime(),
}).map(timestamp => startOfDay(new Date(timestamp)));

// Generator for valid streak counts
const validStreakArb = fc.integer({ min: 0, max: 1000 });

// Generator for streak input with null lastStudyDate
const nullLastStudyInputArb = fc.record({
  lastStudyDate: fc.constant(null),
  currentStreak: validStreakArb,
  todayDate: validDateArb,
});

// Generator for streak input with valid lastStudyDate
const validLastStudyInputArb = fc.record({
  lastStudyDate: validDateArb,
  currentStreak: validStreakArb,
  todayDate: validDateArb,
});

/**
 * **Feature: cellines-obgyn-prep-v1, Property 1: Streak Calculation Correctness**
 * **Validates: Requirements 1.2, 1.3, 1.4**
 * 
 * For any user stats state with a `last_study_date` and `current_streak`, and for any `today_date`:
 * - If `today_date` equals `last_study_date`, the streak SHALL remain unchanged
 * - If `today_date` is exactly one day after `last_study_date`, the streak SHALL increment by 1
 * - If `today_date` is more than one day after `last_study_date`, the streak SHALL reset to 1
 */
describe('Property 1: Streak Calculation Correctness', () => {
  test('Same day study keeps streak unchanged', () => {
    fc.assert(
      fc.property(validDateArb, validStreakArb, (date, currentStreak) => {
        // Ensure currentStreak is at least 1 for same-day scenario (user has studied before)
        const streak = Math.max(1, currentStreak);
        const input: StreakInput = {
          lastStudyDate: date,
          currentStreak: streak,
          todayDate: date, // Same day
        };
        const result = calculateStreak(input);
        
        expect(result.newStreak).toBe(streak);
        expect(result.isNewDay).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('Consecutive day study increments streak by 1', () => {
    fc.assert(
      fc.property(validDateArb, validStreakArb, (lastStudyDate, currentStreak) => {
        const todayDate = addDays(lastStudyDate, 1); // Next day
        const input: StreakInput = {
          lastStudyDate,
          currentStreak,
          todayDate,
        };
        const result = calculateStreak(input);
        
        expect(result.newStreak).toBe(currentStreak + 1);
        expect(result.isNewDay).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Gap day study (more than 1 day) resets streak to 1', () => {
    // Generate gap of 2 or more days
    const gapDaysArb = fc.integer({ min: 2, max: 365 });
    
    fc.assert(
      fc.property(validDateArb, validStreakArb, gapDaysArb, (lastStudyDate, currentStreak, gapDays) => {
        const todayDate = addDays(lastStudyDate, gapDays);
        const input: StreakInput = {
          lastStudyDate,
          currentStreak,
          todayDate,
        };
        const result = calculateStreak(input);
        
        expect(result.newStreak).toBe(1);
        expect(result.isNewDay).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('First study ever (null lastStudyDate) starts streak at 1', () => {
    fc.assert(
      fc.property(nullLastStudyInputArb, (input) => {
        const result = calculateStreak(input);
        
        expect(result.newStreak).toBe(1);
        expect(result.isNewDay).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cellines-obgyn-prep-v1, Property 2: Longest Streak Invariant**
 * **Validates: Requirements 1.5**
 * 
 * For any user stats state, after any streak update operation,
 * `longest_streak` SHALL be greater than or equal to `current_streak`.
 */
describe('Property 2: Longest Streak Invariant', () => {
  test('Longest streak is always >= current streak after update', () => {
    fc.assert(
      fc.property(validStreakArb, validStreakArb, (currentStreak, longestStreak) => {
        const result = updateLongestStreak(currentStreak, longestStreak);
        
        // The result should be >= currentStreak
        expect(result).toBeGreaterThanOrEqual(currentStreak);
        // The result should also be >= the original longestStreak
        expect(result).toBeGreaterThanOrEqual(longestStreak);
      }),
      { numRuns: 100 }
    );
  });

  test('Longest streak updates when current exceeds it', () => {
    fc.assert(
      fc.property(validStreakArb, (longestStreak) => {
        const currentStreak = longestStreak + 1; // Current exceeds longest
        const result = updateLongestStreak(currentStreak, longestStreak);
        
        expect(result).toBe(currentStreak);
      }),
      { numRuns: 100 }
    );
  });

  test('Longest streak stays same when current is less', () => {
    // Generate longestStreak > 0 so we can have currentStreak < longestStreak
    const positiveLongestArb = fc.integer({ min: 1, max: 1000 });
    
    fc.assert(
      fc.property(positiveLongestArb, (longestStreak) => {
        const currentStreak = longestStreak - 1; // Current is less than longest
        const result = updateLongestStreak(currentStreak, longestStreak);
        
        expect(result).toBe(longestStreak);
      }),
      { numRuns: 100 }
    );
  });

  test('Invariant holds after sequence of streak calculations', () => {
    // Generate a sequence of day gaps (0 = same day, 1 = consecutive, 2+ = gap)
    const dayGapSequenceArb = fc.array(
      fc.integer({ min: 0, max: 10 }),
      { minLength: 1, maxLength: 20 }
    );
    
    fc.assert(
      fc.property(validDateArb, dayGapSequenceArb, (startDate, dayGaps) => {
        let currentStreak = 0;
        let longestStreak = 0;
        let lastStudyDate: Date | null = null;
        let currentDate = startDate;
        
        for (const gap of dayGaps) {
          currentDate = addDays(currentDate, gap);
          
          const streakResult = calculateStreak({
            lastStudyDate,
            currentStreak,
            todayDate: currentDate,
          });
          
          currentStreak = streakResult.newStreak;
          lastStudyDate = streakResult.lastStudyDate;
          longestStreak = updateLongestStreak(currentStreak, longestStreak);
          
          // Invariant: longest >= current after every update
          expect(longestStreak).toBeGreaterThanOrEqual(currentStreak);
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: cellines-obgyn-prep-v1, Property 3: Total Reviews Increment**
 * **Validates: Requirements 1.6**
 * 
 * For any card rating action, the `total_reviews` count SHALL increase by exactly 1.
 */
describe('Property 3: Total Reviews Increment', () => {
  test('Total reviews increases by exactly 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000000 }), (totalReviews) => {
        const result = incrementTotalReviews(totalReviews);
        
        expect(result).toBe(totalReviews + 1);
      }),
      { numRuns: 100 }
    );
  });

  test('Total reviews increment is idempotent in effect (always +1)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000000 }), fc.integer({ min: 1, max: 100 }), (initialTotal, numIncrements) => {
        let total = initialTotal;
        
        for (let i = 0; i < numIncrements; i++) {
          total = incrementTotalReviews(total);
        }
        
        expect(total).toBe(initialTotal + numIncrements);
      }),
      { numRuns: 100 }
    );
  });

  test('Total reviews never decreases', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000000 }), (totalReviews) => {
        const result = incrementTotalReviews(totalReviews);
        
        expect(result).toBeGreaterThan(totalReviews);
      }),
      { numRuns: 100 }
    );
  });
});
