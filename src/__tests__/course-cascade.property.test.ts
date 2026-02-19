import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  cascadeDeleteCourse,
  cascadeDeleteUnit,
  CourseHierarchy,
} from '../lib/course-cascade';
import type { Course, Unit, Lesson, LessonItem, LessonItemType } from '@/types/database';

/**
 * **Feature: cekatan, Property 7: Course Hierarchy Cascade Delete**
 * **Validates: Requirements 4.5, 4.6**
 *
 * For any course deletion:
 * - All units belonging to that course SHALL be deleted
 * - All lessons belonging to those units SHALL be deleted
 * - All lesson_items belonging to those lessons SHALL be deleted
 *
 * For any unit deletion:
 * - All lessons belonging to that unit SHALL be deleted
 * - All lesson_items belonging to those lessons SHALL be deleted
 */
describe('Property 7: Course Hierarchy Cascade Delete', () => {
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

  // Generator for Unit (with course_id to be set later)
  const unitArb = fc.record({
    id: uuidArb,
    course_id: uuidArb,
    title: titleArb,
    order_index: fc.nat({ max: 100 }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<Unit>;

  // Generator for Lesson (with unit_id to be set later)
  const lessonArb = fc.record({
    id: uuidArb,
    unit_id: uuidArb,
    title: titleArb,
    order_index: fc.nat({ max: 100 }),
    target_item_count: fc.integer({ min: 1, max: 50 }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<Lesson>;

  // Generator for LessonItem (with lesson_id to be set later)
  const lessonItemArb = fc.record({
    id: uuidArb,
    lesson_id: uuidArb,
    item_type: fc.constantFrom<LessonItemType>('mcq', 'card'),
    item_id: uuidArb,
    order_index: fc.nat({ max: 100 }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<LessonItem>;

  // Generator for a complete course hierarchy
  const hierarchyArb = fc
    .record({
      course: courseArb,
      units: fc.array(unitArb, { minLength: 0, maxLength: 5 }),
      lessons: fc.array(lessonArb, { minLength: 0, maxLength: 10 }),
      lessonItems: fc.array(lessonItemArb, { minLength: 0, maxLength: 20 }),
    })
    .map(({ course, units, lessons, lessonItems }) => {
      // Link units to the course
      const linkedUnits = units.map((u) => ({ ...u, course_id: course.id }));
      const unitIds = linkedUnits.map((u) => u.id);

      // Link lessons to random units (if any units exist)
      const linkedLessons =
        unitIds.length > 0
          ? lessons.map((l, i) => ({
              ...l,
              unit_id: unitIds[i % unitIds.length],
            }))
          : [];
      const lessonIds = linkedLessons.map((l) => l.id);

      // Link lesson items to random lessons (if any lessons exist)
      const linkedItems =
        lessonIds.length > 0
          ? lessonItems.map((li, i) => ({
              ...li,
              lesson_id: lessonIds[i % lessonIds.length],
            }))
          : [];

      return {
        courses: [course],
        units: linkedUnits,
        lessons: linkedLessons,
        lessonItems: linkedItems,
      } as CourseHierarchy;
    });

  describe('Course Cascade Delete', () => {
    test('deleting a course removes all its units', () => {
      fc.assert(
        fc.property(hierarchyArb, (hierarchy) => {
          const courseId = hierarchy.courses[0]?.id;
          if (!courseId) return true; // Skip if no course

          const result = cascadeDeleteCourse(hierarchy, courseId);

          // No units should reference the deleted course
          const orphanedUnits = result.units.filter((u) => u.course_id === courseId);
          expect(orphanedUnits).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    test('deleting a course removes all lessons in its units', () => {
      fc.assert(
        fc.property(hierarchyArb, (hierarchy) => {
          const courseId = hierarchy.courses[0]?.id;
          if (!courseId) return true;

          // Get unit IDs belonging to this course before deletion
          const unitIds = hierarchy.units
            .filter((u) => u.course_id === courseId)
            .map((u) => u.id);

          const result = cascadeDeleteCourse(hierarchy, courseId);

          // No lessons should reference any of the deleted units
          const orphanedLessons = result.lessons.filter((l) => unitIds.includes(l.unit_id));
          expect(orphanedLessons).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    test('deleting a course removes all lesson items in its lessons', () => {
      fc.assert(
        fc.property(hierarchyArb, (hierarchy) => {
          const courseId = hierarchy.courses[0]?.id;
          if (!courseId) return true;

          // Get unit IDs belonging to this course
          const unitIds = hierarchy.units
            .filter((u) => u.course_id === courseId)
            .map((u) => u.id);

          // Get lesson IDs belonging to those units
          const lessonIds = hierarchy.lessons
            .filter((l) => unitIds.includes(l.unit_id))
            .map((l) => l.id);

          const result = cascadeDeleteCourse(hierarchy, courseId);

          // No lesson items should reference any of the deleted lessons
          const orphanedItems = result.lessonItems.filter((li) =>
            lessonIds.includes(li.lesson_id)
          );
          expect(orphanedItems).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    test('deleting a course does not affect other courses', () => {
      fc.assert(
        fc.property(hierarchyArb, courseArb, (hierarchy, otherCourse) => {
          // Add another course to the hierarchy
          const extendedHierarchy: CourseHierarchy = {
            ...hierarchy,
            courses: [...hierarchy.courses, otherCourse],
          };

          const courseToDelete = hierarchy.courses[0]?.id;
          if (!courseToDelete) return true;

          const result = cascadeDeleteCourse(extendedHierarchy, courseToDelete);

          // The other course should still exist
          expect(result.courses.find((c) => c.id === otherCourse.id)).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Cascade Delete', () => {
    test('deleting a unit removes all its lessons', () => {
      fc.assert(
        fc.property(hierarchyArb, (hierarchy) => {
          const unitId = hierarchy.units[0]?.id;
          if (!unitId) return true;

          const result = cascadeDeleteUnit(hierarchy, unitId);

          // No lessons should reference the deleted unit
          const orphanedLessons = result.lessons.filter((l) => l.unit_id === unitId);
          expect(orphanedLessons).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    test('deleting a unit removes all lesson items in its lessons', () => {
      fc.assert(
        fc.property(hierarchyArb, (hierarchy) => {
          const unitId = hierarchy.units[0]?.id;
          if (!unitId) return true;

          // Get lesson IDs belonging to this unit
          const lessonIds = hierarchy.lessons
            .filter((l) => l.unit_id === unitId)
            .map((l) => l.id);

          const result = cascadeDeleteUnit(hierarchy, unitId);

          // No lesson items should reference any of the deleted lessons
          const orphanedItems = result.lessonItems.filter((li) =>
            lessonIds.includes(li.lesson_id)
          );
          expect(orphanedItems).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    test('deleting a unit does not affect other units', () => {
      fc.assert(
        fc.property(hierarchyArb, (hierarchy) => {
          fc.pre(hierarchy.units.length >= 2);

          const unitToDelete = hierarchy.units[0].id;
          const otherUnit = hierarchy.units[1];

          const result = cascadeDeleteUnit(hierarchy, unitToDelete);

          // The other unit should still exist
          expect(result.units.find((u) => u.id === otherUnit.id)).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    test('deleting a unit does not affect the parent course', () => {
      fc.assert(
        fc.property(hierarchyArb, (hierarchy) => {
          const unitId = hierarchy.units[0]?.id;
          if (!unitId) return true;

          const result = cascadeDeleteUnit(hierarchy, unitId);

          // All courses should still exist
          expect(result.courses).toEqual(hierarchy.courses);
        }),
        { numRuns: 100 }
      );
    });
  });
});
