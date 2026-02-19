import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { checkLessonProgressOwnership } from '../lib/course-authorization';
import type { LessonProgress } from '@/types/database';

/**
 * **Feature: cekatan, Property 12: Lesson Progress RLS**
 * **Validates: Requirements 7.2**
 *
 * For any user, queries against lesson_progress SHALL only return records
 * where user_id matches auth.uid().
 */
describe('Property 12: Lesson Progress RLS', () => {
  // Generator for valid UUIDs
  const uuidArb = fc.uuid();

  // Generator for ISO date strings
  const minTimestamp = new Date('2020-01-01').getTime();
  const maxTimestamp = new Date('2030-12-31').getTime();
  const isoDateArb = fc
    .integer({ min: minTimestamp, max: maxTimestamp })
    .map((ts) => new Date(ts).toISOString());

  // Generator for LessonProgress
  const lessonProgressArb = fc.record({
    id: uuidArb,
    user_id: uuidArb,
    lesson_id: uuidArb,
    last_completed_at: isoDateArb,
    best_score: fc.integer({ min: 0, max: 100 }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<LessonProgress>;

  test('authorizes lesson progress access when user owns the record', () => {
    fc.assert(
      fc.property(uuidArb, lessonProgressArb, (userId, progress) => {
        const ownedProgress: LessonProgress = { ...progress, user_id: userId };
        const result = checkLessonProgressOwnership(userId, ownedProgress);

        expect(result.authorized).toBe(true);
        expect(result.reason).toBe('authorized');
      }),
      { numRuns: 100 }
    );
  });

  test('denies lesson progress access when user does not own the record', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, lessonProgressArb, (userId, otherUserId, progress) => {
        fc.pre(userId !== otherUserId);
        const otherUserProgress: LessonProgress = { ...progress, user_id: otherUserId };
        const result = checkLessonProgressOwnership(userId, otherUserProgress);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('not_owner');
      }),
      { numRuns: 100 }
    );
  });

  test('denies lesson progress access when user is not authenticated', () => {
    fc.assert(
      fc.property(lessonProgressArb, (progress) => {
        const result = checkLessonProgressOwnership(null, progress);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('no_user');
      }),
      { numRuns: 100 }
    );
  });

  test('denies lesson progress access when record is null', () => {
    fc.assert(
      fc.property(uuidArb, (userId) => {
        const result = checkLessonProgressOwnership(userId, null);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('not_found');
      }),
      { numRuns: 100 }
    );
  });
});
