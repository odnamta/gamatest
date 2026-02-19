import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateLessonStatus,
  buildProgressMap,
  LessonStatusInput,
} from '../lib/lesson-status';
import { LessonProgress, LessonStatus } from '../types/database';

/**
 * Lesson Status Property-Based Tests
 * 
 * These tests verify the correctness properties of the lesson lock/unlock
 * status calculation as specified in the design document.
 * 
 * **Feature: cekatan, Property 11: Lesson Lock Status Logic**
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 7.3**
 */

// Generator for valid UUIDs
const uuidArb = fc.uuid();

// Generator for valid order indices
const orderIndexArb = fc.integer({ min: 0, max: 100 });

// Generator for valid ISO date strings (using timestamps to avoid invalid date issues)
const minTimestamp = new Date('2020-01-01').getTime();
const maxTimestamp = new Date('2030-12-31').getTime();
const validISODateStringArb = fc.integer({ min: minTimestamp, max: maxTimestamp })
  .map(ts => new Date(ts).toISOString());

// Generator for a LessonProgress record
const lessonProgressArb = fc.record({
  id: uuidArb,
  user_id: uuidArb,
  lesson_id: uuidArb,
  last_completed_at: validISODateStringArb,
  best_score: fc.integer({ min: 0, max: 100 }),
  created_at: validISODateStringArb,
});

// Generator for a progress map with specific lesson IDs
const progressMapWithLessonsArb = (lessonIds: string[]) =>
  fc.array(fc.constantFrom(...lessonIds), { minLength: 0, maxLength: lessonIds.length })
    .chain(completedIds => {
      const uniqueIds = [...new Set(completedIds)];
      return fc.tuple(
        ...uniqueIds.map(id =>
          lessonProgressArb.map(progress => ({ ...progress, lesson_id: id }))
        )
      ).map(progressRecords => buildProgressMap(progressRecords));
    });

describe('Property 11: Lesson Lock Status Logic', () => {
  /**
   * If L is the first lesson of the first unit (order_index 0 in unit with order_index 0),
   * status SHALL be 'unlocked' or 'completed'
   */
  test('First lesson of first unit is never locked', () => {
    fc.assert(
      fc.property(
        uuidArb, // currentLessonId
        uuidArb, // userId for progress
        fc.boolean(), // hasOwnProgress
        (currentLessonId, userId, hasOwnProgress) => {
          const progressMap = new Map<string, LessonProgress>();
          
          if (hasOwnProgress) {
            progressMap.set(currentLessonId, {
              id: 'progress-1',
              user_id: userId,
              lesson_id: currentLessonId,
              last_completed_at: new Date().toISOString(),
              best_score: 80,
              created_at: new Date().toISOString(),
            });
          }

          const input: LessonStatusInput = {
            lessonOrderIndex: 0,
            unitOrderIndex: 0,
            progressMap,
            previousLessonId: null,
            currentLessonId,
          };

          const status = calculateLessonStatus(input);

          // First lesson should never be locked
          expect(status).not.toBe('locked');
          
          // Should be 'completed' if has progress, 'unlocked' otherwise
          if (hasOwnProgress) {
            expect(status).toBe('completed');
          } else {
            expect(status).toBe('unlocked');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * If L has a previous lesson P and P has no lesson_progress record,
   * L status SHALL be 'locked' (unless L itself is completed)
   */
  test('Lesson is locked when previous lesson is not completed', () => {
    fc.assert(
      fc.property(
        uuidArb, // currentLessonId
        uuidArb, // previousLessonId
        orderIndexArb.filter(i => i > 0), // lessonOrderIndex (not first)
        orderIndexArb, // unitOrderIndex
        (currentLessonId, previousLessonId, lessonOrderIndex, unitOrderIndex) => {
          // Ensure we're not testing the first lesson of first unit
          const effectiveUnitIndex = lessonOrderIndex === 0 ? Math.max(1, unitOrderIndex) : unitOrderIndex;
          
          // Empty progress map - no lessons completed
          const progressMap = new Map<string, LessonProgress>();

          const input: LessonStatusInput = {
            lessonOrderIndex,
            unitOrderIndex: effectiveUnitIndex,
            progressMap,
            previousLessonId,
            currentLessonId,
          };

          const status = calculateLessonStatus(input);

          // Should be locked since previous is not completed
          expect(status).toBe('locked');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * If L has a previous lesson P and P has a lesson_progress record,
   * L status SHALL be 'unlocked' or 'completed'
   */
  test('Lesson is unlocked when previous lesson is completed', () => {
    fc.assert(
      fc.property(
        uuidArb, // currentLessonId
        uuidArb, // previousLessonId
        uuidArb, // userId
        orderIndexArb.filter(i => i > 0), // lessonOrderIndex (not first)
        orderIndexArb, // unitOrderIndex
        fc.boolean(), // hasOwnProgress
        (currentLessonId, previousLessonId, userId, lessonOrderIndex, unitOrderIndex, hasOwnProgress) => {
          const progressMap = new Map<string, LessonProgress>();
          
          // Previous lesson is completed
          progressMap.set(previousLessonId, {
            id: 'progress-prev',
            user_id: userId,
            lesson_id: previousLessonId,
            last_completed_at: new Date().toISOString(),
            best_score: 75,
            created_at: new Date().toISOString(),
          });

          // Optionally, current lesson is also completed
          if (hasOwnProgress) {
            progressMap.set(currentLessonId, {
              id: 'progress-current',
              user_id: userId,
              lesson_id: currentLessonId,
              last_completed_at: new Date().toISOString(),
              best_score: 90,
              created_at: new Date().toISOString(),
            });
          }

          const input: LessonStatusInput = {
            lessonOrderIndex,
            unitOrderIndex,
            progressMap,
            previousLessonId,
            currentLessonId,
          };

          const status = calculateLessonStatus(input);

          // Should not be locked since previous is completed
          expect(status).not.toBe('locked');
          
          // Should be 'completed' if has own progress, 'unlocked' otherwise
          if (hasOwnProgress) {
            expect(status).toBe('completed');
          } else {
            expect(status).toBe('unlocked');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * If L has a lesson_progress record, status SHALL be 'completed'
   */
  test('Lesson with progress record is always completed', () => {
    fc.assert(
      fc.property(
        uuidArb, // currentLessonId
        fc.option(uuidArb, { nil: undefined }), // previousLessonId (optional)
        uuidArb, // userId
        orderIndexArb, // lessonOrderIndex
        orderIndexArb, // unitOrderIndex
        fc.boolean(), // hasPreviousProgress
        (currentLessonId, previousLessonId, userId, lessonOrderIndex, unitOrderIndex, hasPreviousProgress) => {
          const progressMap = new Map<string, LessonProgress>();
          
          // Current lesson is completed
          progressMap.set(currentLessonId, {
            id: 'progress-current',
            user_id: userId,
            lesson_id: currentLessonId,
            last_completed_at: new Date().toISOString(),
            best_score: 85,
            created_at: new Date().toISOString(),
          });

          // Optionally, previous lesson is also completed
          if (hasPreviousProgress && previousLessonId) {
            progressMap.set(previousLessonId, {
              id: 'progress-prev',
              user_id: userId,
              lesson_id: previousLessonId,
              last_completed_at: new Date().toISOString(),
              best_score: 70,
              created_at: new Date().toISOString(),
            });
          }

          const input: LessonStatusInput = {
            lessonOrderIndex,
            unitOrderIndex,
            progressMap,
            previousLessonId: previousLessonId ?? null,
            currentLessonId,
          };

          const status = calculateLessonStatus(input);

          // Should always be completed when has own progress
          expect(status).toBe('completed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Status transitions are deterministic - same input always produces same output
   */
  test('Status calculation is deterministic', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.option(uuidArb, { nil: undefined }),
        orderIndexArb,
        orderIndexArb,
        fc.array(uuidArb, { minLength: 0, maxLength: 5 }),
        (currentLessonId, previousLessonId, lessonOrderIndex, unitOrderIndex, completedLessonIds) => {
          // Build progress map from completed lesson IDs
          const progressMap = new Map<string, LessonProgress>();
          for (const lessonId of completedLessonIds) {
            progressMap.set(lessonId, {
              id: `progress-${lessonId}`,
              user_id: 'user-1',
              lesson_id: lessonId,
              last_completed_at: new Date().toISOString(),
              best_score: 80,
              created_at: new Date().toISOString(),
            });
          }

          const input: LessonStatusInput = {
            lessonOrderIndex,
            unitOrderIndex,
            progressMap,
            previousLessonId: previousLessonId ?? null,
            currentLessonId,
          };

          // Calculate status twice
          const status1 = calculateLessonStatus(input);
          const status2 = calculateLessonStatus(input);

          // Should be identical
          expect(status1).toBe(status2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * First lesson of non-first unit follows same rules as other lessons
   * (locked if previous unit's last lesson not completed)
   */
  test('First lesson of non-first unit is locked without previous completion', () => {
    fc.assert(
      fc.property(
        uuidArb, // currentLessonId
        uuidArb, // previousLessonId (last lesson of previous unit)
        fc.integer({ min: 1, max: 100 }), // unitOrderIndex (not first unit)
        (currentLessonId, previousLessonId, unitOrderIndex) => {
          // Empty progress map - no lessons completed
          const progressMap = new Map<string, LessonProgress>();

          const input: LessonStatusInput = {
            lessonOrderIndex: 0, // First lesson in this unit
            unitOrderIndex, // But not first unit
            progressMap,
            previousLessonId, // Last lesson of previous unit
            currentLessonId,
          };

          const status = calculateLessonStatus(input);

          // Should be locked since previous unit's last lesson is not completed
          expect(status).toBe('locked');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('buildProgressMap helper', () => {
  test('Builds map correctly from progress records', () => {
    fc.assert(
      fc.property(
        fc.array(lessonProgressArb, { minLength: 0, maxLength: 20 }),
        (progressRecords) => {
          const map = buildProgressMap(progressRecords);

          // Map should contain all unique lesson_ids
          const uniqueLessonIds = new Set(progressRecords.map(p => p.lesson_id));
          expect(map.size).toBeLessThanOrEqual(progressRecords.length);
          
          // Each record should be retrievable by lesson_id
          for (const record of progressRecords) {
            expect(map.has(record.lesson_id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Empty array produces empty map', () => {
    const map = buildProgressMap([]);
    expect(map.size).toBe(0);
  });
});
