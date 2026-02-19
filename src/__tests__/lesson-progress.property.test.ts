import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import type { LessonProgress } from '../types/database';

/**
 * Lesson Progress Persistence Property-Based Tests
 * 
 * These tests verify the correctness properties of lesson progress persistence
 * as specified in the design document.
 * 
 * **Feature: cekatan, Property 10: Lesson Progress Persistence**
 * **Validates: Requirements 5.4, 7.1, 7.4**
 */

// Generator for valid UUIDs
const uuidArb = fc.uuid();

// Generator for scores (0 to totalItems)
const scoreArb = (maxScore: number) => fc.integer({ min: 0, max: maxScore });

// Generator for total items in a lesson
const totalItemsArb = fc.integer({ min: 1, max: 100 });

// Generator for valid dates using integer timestamps to avoid NaN/Invalid dates during shrinking
const validDateArb = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(ts => new Date(ts));

/**
 * Simulates the lesson progress upsert logic from completeLessonAction.
 * This is the core logic we want to test.
 * 
 * Requirements:
 * - 5.4: Record completion in lesson_progress with timestamp and score
 * - 7.1: Upsert lesson_progress record with user_id, lesson_id, last_completed_at
 * - 7.4: Update best_score if new score is higher
 */
export interface LessonCompletionInput {
  userId: string;
  lessonId: string;
  score: number;
  existingProgress: LessonProgress | null;
  completionTime: Date;
}

export interface LessonCompletionResult {
  lessonProgress: LessonProgress;
  isNewBest: boolean;
}

/**
 * Pure function that calculates the new lesson progress state.
 * This simulates the upsert logic in completeLessonAction.
 */
export function calculateLessonProgress(input: LessonCompletionInput): LessonCompletionResult {
  const { userId, lessonId, score, existingProgress, completionTime } = input;

  if (existingProgress) {
    // Update existing progress
    const isNewBest = score > existingProgress.best_score;
    const newBestScore = isNewBest ? score : existingProgress.best_score;

    return {
      lessonProgress: {
        ...existingProgress,
        last_completed_at: completionTime.toISOString(),
        best_score: newBestScore,
      },
      isNewBest,
    };
  }

  // Create new progress record
  return {
    lessonProgress: {
      id: `new-progress-${Date.now()}`,
      user_id: userId,
      lesson_id: lessonId,
      last_completed_at: completionTime.toISOString(),
      best_score: score,
      created_at: completionTime.toISOString(),
    },
    isNewBest: true, // First completion is always a new best
  };
}

/**
 * Pure function that validates lesson progress record structure.
 */
export function isValidLessonProgress(progress: LessonProgress): boolean {
  return (
    typeof progress.id === 'string' &&
    progress.id.length > 0 &&
    typeof progress.user_id === 'string' &&
    progress.user_id.length > 0 &&
    typeof progress.lesson_id === 'string' &&
    progress.lesson_id.length > 0 &&
    typeof progress.last_completed_at === 'string' &&
    progress.last_completed_at.length > 0 &&
    typeof progress.best_score === 'number' &&
    progress.best_score >= 0 &&
    typeof progress.created_at === 'string' &&
    progress.created_at.length > 0
  );
}

describe('Property 10: Lesson Progress Persistence', () => {
  /**
   * For any lesson completion with score S, a lesson_progress record SHALL exist
   * with user_id, lesson_id, and last_completed_at set to the completion time.
   */
  test('Lesson completion creates valid progress record', () => {
    fc.assert(
      fc.property(
        uuidArb, // userId
        uuidArb, // lessonId
        totalItemsArb, // totalItems
        validDateArb, // completionTime
        (userId, lessonId, totalItems, completionTime) => {
          const score = Math.floor(Math.random() * (totalItems + 1));

          const result = calculateLessonProgress({
            userId,
            lessonId,
            score,
            existingProgress: null,
            completionTime,
          });

          // Verify progress record has required fields
          expect(result.lessonProgress.user_id).toBe(userId);
          expect(result.lessonProgress.lesson_id).toBe(lessonId);
          expect(result.lessonProgress.last_completed_at).toBe(completionTime.toISOString());
          expect(result.lessonProgress.best_score).toBe(score);
          expect(isValidLessonProgress(result.lessonProgress)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * If no previous progress exists, best_score SHALL be set to S.
   */
  test('First completion sets best_score to current score', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        totalItemsArb,
        validDateArb,
        (userId, lessonId, totalItems, completionTime) => {
          const score = Math.floor(Math.random() * (totalItems + 1));

          const result = calculateLessonProgress({
            userId,
            lessonId,
            score,
            existingProgress: null,
            completionTime,
          });

          expect(result.lessonProgress.best_score).toBe(score);
          expect(result.isNewBest).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * If previous progress exists with best_score B, the new best_score SHALL be max(B, S).
   */
  test('Best score is max of previous and current score', () => {
    fc.assert(
      fc.property(
        uuidArb, // userId
        uuidArb, // lessonId
        uuidArb, // progressId
        totalItemsArb, // totalItems
        validDateArb, // originalCompletionTime
        validDateArb, // newCompletionTime
        (userId, lessonId, progressId, totalItems, originalTime, newTime) => {
          const previousScore = Math.floor(Math.random() * (totalItems + 1));
          const newScore = Math.floor(Math.random() * (totalItems + 1));

          const existingProgress: LessonProgress = {
            id: progressId,
            user_id: userId,
            lesson_id: lessonId,
            last_completed_at: originalTime.toISOString(),
            best_score: previousScore,
            created_at: originalTime.toISOString(),
          };

          const result = calculateLessonProgress({
            userId,
            lessonId,
            score: newScore,
            existingProgress,
            completionTime: newTime,
          });

          // Best score should be max of previous and new
          expect(result.lessonProgress.best_score).toBe(Math.max(previousScore, newScore));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * isNewBest is true only when new score exceeds previous best.
   */
  test('isNewBest is true only when score exceeds previous best', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 0, max: 100 }), // previousScore
        fc.integer({ min: 0, max: 100 }), // newScore
        validDateArb,
        validDateArb,
        (userId, lessonId, progressId, previousScore, newScore, originalTime, newTime) => {
          const existingProgress: LessonProgress = {
            id: progressId,
            user_id: userId,
            lesson_id: lessonId,
            last_completed_at: originalTime.toISOString(),
            best_score: previousScore,
            created_at: originalTime.toISOString(),
          };

          const result = calculateLessonProgress({
            userId,
            lessonId,
            score: newScore,
            existingProgress,
            completionTime: newTime,
          });

          // isNewBest should be true only if newScore > previousScore
          expect(result.isNewBest).toBe(newScore > previousScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Completion always updates last_completed_at to the new completion time.
   */
  test('Completion updates last_completed_at', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 0, max: 100 }),
        validDateArb,
        validDateArb,
        (userId, lessonId, progressId, score, originalTime, newTime) => {
          const existingProgress: LessonProgress = {
            id: progressId,
            user_id: userId,
            lesson_id: lessonId,
            last_completed_at: originalTime.toISOString(),
            best_score: score,
            created_at: originalTime.toISOString(),
          };

          const result = calculateLessonProgress({
            userId,
            lessonId,
            score,
            existingProgress,
            completionTime: newTime,
          });

          // last_completed_at should be updated to new time
          expect(result.lessonProgress.last_completed_at).toBe(newTime.toISOString());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Progress record preserves user_id and lesson_id on update.
   */
  test('Update preserves user_id and lesson_id', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 0, max: 100 }),
        validDateArb,
        validDateArb,
        (userId, lessonId, progressId, score, originalTime, newTime) => {
          const existingProgress: LessonProgress = {
            id: progressId,
            user_id: userId,
            lesson_id: lessonId,
            last_completed_at: originalTime.toISOString(),
            best_score: score,
            created_at: originalTime.toISOString(),
          };

          const result = calculateLessonProgress({
            userId,
            lessonId,
            score: score + 1,
            existingProgress,
            completionTime: newTime,
          });

          // user_id and lesson_id should be preserved
          expect(result.lessonProgress.user_id).toBe(userId);
          expect(result.lessonProgress.lesson_id).toBe(lessonId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Best score never decreases.
   */
  test('Best score never decreases', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 0, max: 100 }), // previousBest
        fc.integer({ min: 0, max: 100 }), // newScore
        validDateArb,
        validDateArb,
        (userId, lessonId, progressId, previousBest, newScore, originalTime, newTime) => {
          const existingProgress: LessonProgress = {
            id: progressId,
            user_id: userId,
            lesson_id: lessonId,
            last_completed_at: originalTime.toISOString(),
            best_score: previousBest,
            created_at: originalTime.toISOString(),
          };

          const result = calculateLessonProgress({
            userId,
            lessonId,
            score: newScore,
            existingProgress,
            completionTime: newTime,
          });

          // Best score should never decrease
          expect(result.lessonProgress.best_score).toBeGreaterThanOrEqual(previousBest);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Multiple completions with increasing scores all become new bests.
   */
  test('Increasing scores are all new bests', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 10 }),
        validDateArb,
        (userId, lessonId, scores, startTime) => {
          // Sort scores to be increasing
          const sortedScores = [...scores].sort((a, b) => a - b);
          
          let currentProgress: LessonProgress | null = null;
          let currentTime = startTime;

          for (let i = 0; i < sortedScores.length; i++) {
            const score = sortedScores[i];
            currentTime = new Date(currentTime.getTime() + 1000); // Advance time

            const result = calculateLessonProgress({
              userId,
              lessonId,
              score,
              existingProgress: currentProgress,
              completionTime: currentTime,
            });

            // First completion or strictly increasing score should be new best
            if (currentProgress === null || score > currentProgress.best_score) {
              expect(result.isNewBest).toBe(true);
            }

            currentProgress = result.lessonProgress;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Score of 0 is valid and creates a valid progress record.
   */
  test('Zero score creates valid progress', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        validDateArb,
        (userId, lessonId, completionTime) => {
          const result = calculateLessonProgress({
            userId,
            lessonId,
            score: 0,
            existingProgress: null,
            completionTime,
          });

          expect(result.lessonProgress.best_score).toBe(0);
          expect(isValidLessonProgress(result.lessonProgress)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
