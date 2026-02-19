import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  checkCourseOwnership,
  checkUnitOwnership,
  checkLessonOwnership,
  checkLessonItemOwnership,
} from '../lib/course-authorization';
import type { Course, Unit, Lesson, LessonItem, LessonItemType } from '@/types/database';

/**
 * **Feature: cekatan, Property 6: Course Hierarchy RLS**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 *
 * For any user:
 * - The user SHALL only see courses where user_id matches their auth.uid()
 * - The user SHALL only see units in courses they own
 * - The user SHALL only see lessons in units of courses they own
 * - The user SHALL only see lesson_items in lessons of courses they own
 */
describe('Property 6: Course Hierarchy RLS', () => {
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

  // Generator for Course
  const courseArb = fc.record({
    id: uuidArb,
    user_id: uuidArb,
    title: titleArb,
    description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<Course>;

  // Generator for Unit
  const unitArb = fc.record({
    id: uuidArb,
    course_id: uuidArb,
    title: titleArb,
    order_index: fc.nat({ max: 100 }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<Unit>;

  // Generator for Lesson
  const lessonArb = fc.record({
    id: uuidArb,
    unit_id: uuidArb,
    title: titleArb,
    order_index: fc.nat({ max: 100 }),
    target_item_count: fc.integer({ min: 1, max: 50 }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<Lesson>;

  // Generator for LessonItem
  const lessonItemArb = fc.record({
    id: uuidArb,
    lesson_id: uuidArb,
    item_type: fc.constantFrom<LessonItemType>('mcq', 'card'),
    item_id: uuidArb,
    order_index: fc.nat({ max: 100 }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<LessonItem>;

  describe('Course Authorization', () => {
    test('authorizes course access when user owns the course', () => {
      fc.assert(
        fc.property(uuidArb, courseArb, (userId, course) => {
          const ownedCourse: Course = { ...course, user_id: userId };
          const result = checkCourseOwnership(userId, ownedCourse);

          expect(result.authorized).toBe(true);
          expect(result.reason).toBe('authorized');
        }),
        { numRuns: 100 }
      );
    });

    test('denies course access when user does not own the course', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, courseArb, (userId, otherUserId, course) => {
          fc.pre(userId !== otherUserId);
          const otherUserCourse: Course = { ...course, user_id: otherUserId };
          const result = checkCourseOwnership(userId, otherUserCourse);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_owner');
        }),
        { numRuns: 100 }
      );
    });

    test('denies course access when user is not authenticated', () => {
      fc.assert(
        fc.property(courseArb, (course) => {
          const result = checkCourseOwnership(null, course);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('no_user');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Authorization', () => {
    test('authorizes unit access when user owns the parent course', () => {
      fc.assert(
        fc.property(uuidArb, courseArb, unitArb, (userId, course, unit) => {
          const ownedCourse: Course = { ...course, user_id: userId };
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id };
          const result = checkUnitOwnership(userId, linkedUnit, ownedCourse);

          expect(result.authorized).toBe(true);
          expect(result.reason).toBe('authorized');
        }),
        { numRuns: 100 }
      );
    });

    test('denies unit access when user does not own the parent course', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, courseArb, unitArb, (userId, otherUserId, course, unit) => {
          fc.pre(userId !== otherUserId);
          const otherUserCourse: Course = { ...course, user_id: otherUserId };
          const linkedUnit: Unit = { ...unit, course_id: otherUserCourse.id };
          const result = checkUnitOwnership(userId, linkedUnit, otherUserCourse);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_owner');
        }),
        { numRuns: 100 }
      );
    });

    test('denies unit access when unit is not in the course', () => {
      fc.assert(
        fc.property(uuidArb, courseArb, unitArb, (userId, course, unit) => {
          const ownedCourse: Course = { ...course, user_id: userId };
          // Unit has a different course_id
          fc.pre(unit.course_id !== ownedCourse.id);
          const result = checkUnitOwnership(userId, unit, ownedCourse);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_found');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Lesson Authorization', () => {
    test('authorizes lesson access when user owns the parent course', () => {
      fc.assert(
        fc.property(uuidArb, courseArb, unitArb, lessonArb, (userId, course, unit, lesson) => {
          const ownedCourse: Course = { ...course, user_id: userId };
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id };
          const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id };
          const result = checkLessonOwnership(userId, linkedLesson, linkedUnit, ownedCourse);

          expect(result.authorized).toBe(true);
          expect(result.reason).toBe('authorized');
        }),
        { numRuns: 100 }
      );
    });

    test('denies lesson access when user does not own the parent course', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          courseArb,
          unitArb,
          lessonArb,
          (userId, otherUserId, course, unit, lesson) => {
            fc.pre(userId !== otherUserId);
            const otherUserCourse: Course = { ...course, user_id: otherUserId };
            const linkedUnit: Unit = { ...unit, course_id: otherUserCourse.id };
            const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id };
            const result = checkLessonOwnership(userId, linkedLesson, linkedUnit, otherUserCourse);

            expect(result.authorized).toBe(false);
            expect(result.reason).toBe('not_owner');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('denies lesson access when lesson is not in the unit', () => {
      fc.assert(
        fc.property(uuidArb, courseArb, unitArb, lessonArb, (userId, course, unit, lesson) => {
          const ownedCourse: Course = { ...course, user_id: userId };
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id };
          // Lesson has a different unit_id
          fc.pre(lesson.unit_id !== linkedUnit.id);
          const result = checkLessonOwnership(userId, lesson, linkedUnit, ownedCourse);

          expect(result.authorized).toBe(false);
          expect(result.reason).toBe('not_found');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('LessonItem Authorization', () => {
    test('authorizes lesson item access when user owns the parent course', () => {
      fc.assert(
        fc.property(
          uuidArb,
          courseArb,
          unitArb,
          lessonArb,
          lessonItemArb,
          (userId, course, unit, lesson, lessonItem) => {
            const ownedCourse: Course = { ...course, user_id: userId };
            const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id };
            const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id };
            const linkedItem: LessonItem = { ...lessonItem, lesson_id: linkedLesson.id };
            const result = checkLessonItemOwnership(
              userId,
              linkedItem,
              linkedLesson,
              linkedUnit,
              ownedCourse
            );

            expect(result.authorized).toBe(true);
            expect(result.reason).toBe('authorized');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('denies lesson item access when user does not own the parent course', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          courseArb,
          unitArb,
          lessonArb,
          lessonItemArb,
          (userId, otherUserId, course, unit, lesson, lessonItem) => {
            fc.pre(userId !== otherUserId);
            const otherUserCourse: Course = { ...course, user_id: otherUserId };
            const linkedUnit: Unit = { ...unit, course_id: otherUserCourse.id };
            const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id };
            const linkedItem: LessonItem = { ...lessonItem, lesson_id: linkedLesson.id };
            const result = checkLessonItemOwnership(
              userId,
              linkedItem,
              linkedLesson,
              linkedUnit,
              otherUserCourse
            );

            expect(result.authorized).toBe(false);
            expect(result.reason).toBe('not_owner');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('denies lesson item access when item is not in the lesson', () => {
      fc.assert(
        fc.property(
          uuidArb,
          courseArb,
          unitArb,
          lessonArb,
          lessonItemArb,
          (userId, course, unit, lesson, lessonItem) => {
            const ownedCourse: Course = { ...course, user_id: userId };
            const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id };
            const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id };
            // LessonItem has a different lesson_id
            fc.pre(lessonItem.lesson_id !== linkedLesson.id);
            const result = checkLessonItemOwnership(
              userId,
              lessonItem,
              linkedLesson,
              linkedUnit,
              ownedCourse
            );

            expect(result.authorized).toBe(false);
            expect(result.reason).toBe('not_found');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
