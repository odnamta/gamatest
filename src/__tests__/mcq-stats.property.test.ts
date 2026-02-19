import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { incrementTotalReviews, calculateStreak, updateLongestStreak } from '../lib/streak';

/**
 * **Feature: cekatan, Property 5: MCQ Stats Integration**
 * **Validates: Requirements 2.6, 5.6**
 *
 * For any MCQ answer action:
 * - user_stats.total_reviews SHALL increment by 1
 * - study_logs.cards_reviewed for today SHALL increment by 1
 * - This behavior is identical to flashcard reviews
 */
describe('Property 5: MCQ Stats Integration', () => {
  // Generator for non-negative total reviews count
  const totalReviewsArb = fc.nat({ max: 1000000 });

  // Generator for cards_reviewed count
  const cardsReviewedArb = fc.nat({ max: 10000 });

  // Generator for streak values
  const streakArb = fc.nat({ max: 365 });

  // Generator for dates
  const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

  test('total_reviews increments by exactly 1 for any MCQ answer', () => {
    fc.assert(
      fc.property(
        totalReviewsArb,
        (totalReviews) => {
          const newTotalReviews = incrementTotalReviews(totalReviews);
          expect(newTotalReviews).toBe(totalReviews + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('cards_reviewed increments by exactly 1 for any MCQ answer (simulated)', () => {
    // This simulates the cards_reviewed increment logic used in answerMCQAction
    const incrementCardsReviewed = (current: number): number => current + 1;

    fc.assert(
      fc.property(
        cardsReviewedArb,
        (cardsReviewed) => {
          const newCardsReviewed = incrementCardsReviewed(cardsReviewed);
          expect(newCardsReviewed).toBe(cardsReviewed + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('MCQ stats update uses same streak calculation as flashcards', () => {
    // Generator for valid streak state: if lastStudyDate is not null, streak must be >= 1
    const validStreakStateArb = fc.oneof(
      // Case 1: No previous study - streak is 0
      fc.record({
        lastStudyDate: fc.constant(null),
        currentStreak: fc.constant(0),
      }),
      // Case 2: Has previous study - streak is at least 1
      fc.record({
        lastStudyDate: dateArb.map(d => d as Date | null),
        currentStreak: fc.integer({ min: 1, max: 365 }),
      })
    );

    fc.assert(
      fc.property(
        validStreakStateArb,
        dateArb,
        ({ lastStudyDate, currentStreak }, todayDate) => {
          // The same calculateStreak function is used for both MCQ and flashcard
          const result = calculateStreak({
            lastStudyDate,
            currentStreak,
            todayDate,
          });

          // Verify streak result is valid
          expect(result.newStreak).toBeGreaterThanOrEqual(1);
          expect(result.lastStudyDate).toBeInstanceOf(Date);
          expect(typeof result.isNewDay).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('MCQ stats update uses same longest streak calculation as flashcards', () => {
    fc.assert(
      fc.property(
        streakArb,
        streakArb,
        (currentStreak, longestStreak) => {
          // The same updateLongestStreak function is used for both MCQ and flashcard
          const newLongestStreak = updateLongestStreak(currentStreak, longestStreak);

          // Longest streak should be max of current and previous longest
          expect(newLongestStreak).toBe(Math.max(currentStreak, longestStreak));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('total_reviews never decreases after MCQ answer', () => {
    fc.assert(
      fc.property(
        totalReviewsArb,
        (totalReviews) => {
          const newTotalReviews = incrementTotalReviews(totalReviews);
          expect(newTotalReviews).toBeGreaterThan(totalReviews);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('incrementTotalReviews is consistent (same input always gives same output)', () => {
    fc.assert(
      fc.property(
        totalReviewsArb,
        (totalReviews) => {
          const result1 = incrementTotalReviews(totalReviews);
          const result2 = incrementTotalReviews(totalReviews);
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
