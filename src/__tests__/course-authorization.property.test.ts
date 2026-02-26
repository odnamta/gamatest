import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import {
  checkCourseOwnership,
  checkUnitOwnership,
  checkLessonOwnership,
  checkLessonItemOwnership,
  checkLessonProgressOwnership,
} from '../lib/course-authorization'
import type { Course, Unit, Lesson, LessonItem, LessonItemType, LessonProgress } from '@/types/database'

/**
 * Property-based tests for course-authorization.ts
 *
 * Tests authorization properties NOT covered by course-hierarchy-rls.property.test.ts:
 * - Role hierarchy implications (ownership transitivity across hierarchy levels)
 * - Permission consistency (deeper access requires shallower access)
 * - Null/missing input exhaustiveness
 * - Authorization determinism
 * - Result type invariants
 */

// ============================================
// Shared Generators
// ============================================

const uuidArb = fc.uuid()

const minTimestamp = new Date('2020-01-01').getTime()
const maxTimestamp = new Date('2030-12-31').getTime()
const isoDateArb = fc
  .integer({ min: minTimestamp, max: maxTimestamp })
  .map((ts) => new Date(ts).toISOString())

const titleArb = fc.string({ minLength: 1, maxLength: 100 })

const courseArb = fc.record({
  id: uuidArb,
  user_id: uuidArb,
  title: titleArb,
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  created_at: isoDateArb,
}) as fc.Arbitrary<Course>

const unitArb = fc.record({
  id: uuidArb,
  course_id: uuidArb,
  title: titleArb,
  order_index: fc.nat({ max: 100 }),
  created_at: isoDateArb,
}) as fc.Arbitrary<Unit>

const lessonArb = fc.record({
  id: uuidArb,
  unit_id: uuidArb,
  title: titleArb,
  order_index: fc.nat({ max: 100 }),
  target_item_count: fc.integer({ min: 1, max: 50 }),
  created_at: isoDateArb,
}) as fc.Arbitrary<Lesson>

const lessonItemArb = fc.record({
  id: uuidArb,
  lesson_id: uuidArb,
  item_type: fc.constantFrom<LessonItemType>('mcq', 'card'),
  item_id: uuidArb,
  order_index: fc.nat({ max: 100 }),
  created_at: isoDateArb,
}) as fc.Arbitrary<LessonItem>

const lessonProgressArb = fc.record({
  id: uuidArb,
  user_id: uuidArb,
  lesson_id: uuidArb,
  last_completed_at: isoDateArb,
  best_score: fc.integer({ min: 0, max: 100 }),
  created_at: isoDateArb,
}) as fc.Arbitrary<LessonProgress>

// ============================================
// Property: Authorization Result Type Invariants
// ============================================

describe('Authorization Result Type Invariants', () => {
  test('authorized=true always has reason "authorized"', () => {
    fc.assert(
      fc.property(uuidArb, courseArb, (userId, course) => {
        const ownedCourse: Course = { ...course, user_id: userId }
        const result = checkCourseOwnership(userId, ownedCourse)

        if (result.authorized) {
          expect(result.reason).toBe('authorized')
        }
      }),
      { numRuns: 200 }
    )
  })

  test('authorized=false never has reason "authorized"', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, course) => {
          const result = checkCourseOwnership(userId, course)

          if (!result.authorized) {
            expect(result.reason).not.toBe('authorized')
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('reason is always one of the defined values', () => {
    const validReasons = new Set(['authorized', 'no_user', 'not_found', 'not_owner'])

    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, course) => {
          const result = checkCourseOwnership(userId, course)
          expect(validReasons.has(result.reason)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Authorization Determinism
// ============================================

describe('Authorization Determinism', () => {
  test('checkCourseOwnership is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, course) => {
          const r1 = checkCourseOwnership(userId, course)
          const r2 = checkCourseOwnership(userId, course)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkUnitOwnership is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(unitArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, unit, course) => {
          const r1 = checkUnitOwnership(userId, unit, course)
          const r2 = checkUnitOwnership(userId, unit, course)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkLessonOwnership is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(lessonArb, { nil: null }),
        fc.option(unitArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, lesson, unit, course) => {
          const r1 = checkLessonOwnership(userId, lesson, unit, course)
          const r2 = checkLessonOwnership(userId, lesson, unit, course)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkLessonItemOwnership is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(lessonItemArb, { nil: null }),
        fc.option(lessonArb, { nil: null }),
        fc.option(unitArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, item, lesson, unit, course) => {
          const r1 = checkLessonItemOwnership(userId, item, lesson, unit, course)
          const r2 = checkLessonItemOwnership(userId, item, lesson, unit, course)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkLessonProgressOwnership is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(lessonProgressArb, { nil: null }),
        (userId, progress) => {
          const r1 = checkLessonProgressOwnership(userId, progress)
          const r2 = checkLessonProgressOwnership(userId, progress)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Permission Consistency (Hierarchy)
// If you can access a lesson item, you can access its lesson, unit, and course.
// ============================================

describe('Permission Consistency — Hierarchy Implication', () => {
  test('if lessonItem is authorized, then lesson must be authorized', () => {
    fc.assert(
      fc.property(
        uuidArb,
        courseArb,
        unitArb,
        lessonArb,
        lessonItemArb,
        (userId, course, unit, lesson, item) => {
          const ownedCourse: Course = { ...course, user_id: userId }
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id }
          const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id }
          const linkedItem: LessonItem = { ...item, lesson_id: linkedLesson.id }

          const itemResult = checkLessonItemOwnership(
            userId, linkedItem, linkedLesson, linkedUnit, ownedCourse
          )
          const lessonResult = checkLessonOwnership(
            userId, linkedLesson, linkedUnit, ownedCourse
          )

          if (itemResult.authorized) {
            expect(lessonResult.authorized).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('if lesson is authorized, then unit must be authorized', () => {
    fc.assert(
      fc.property(
        uuidArb,
        courseArb,
        unitArb,
        lessonArb,
        (userId, course, unit, lesson) => {
          const ownedCourse: Course = { ...course, user_id: userId }
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id }
          const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id }

          const lessonResult = checkLessonOwnership(
            userId, linkedLesson, linkedUnit, ownedCourse
          )
          const unitResult = checkUnitOwnership(userId, linkedUnit, ownedCourse)

          if (lessonResult.authorized) {
            expect(unitResult.authorized).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('if unit is authorized, then course must be authorized', () => {
    fc.assert(
      fc.property(
        uuidArb,
        courseArb,
        unitArb,
        (userId, course, unit) => {
          const ownedCourse: Course = { ...course, user_id: userId }
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id }

          const unitResult = checkUnitOwnership(userId, linkedUnit, ownedCourse)
          const courseResult = checkCourseOwnership(userId, ownedCourse)

          if (unitResult.authorized) {
            expect(courseResult.authorized).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('full chain: authorized lessonItem implies authorized course', () => {
    fc.assert(
      fc.property(
        uuidArb,
        courseArb,
        unitArb,
        lessonArb,
        lessonItemArb,
        (userId, course, unit, lesson, item) => {
          const ownedCourse: Course = { ...course, user_id: userId }
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id }
          const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id }
          const linkedItem: LessonItem = { ...item, lesson_id: linkedLesson.id }

          const itemResult = checkLessonItemOwnership(
            userId, linkedItem, linkedLesson, linkedUnit, ownedCourse
          )
          const courseResult = checkCourseOwnership(userId, ownedCourse)

          if (itemResult.authorized) {
            expect(courseResult.authorized).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Null Input Exhaustiveness
// Every function should handle all null combinations gracefully.
// ============================================

describe('Null Input Exhaustiveness', () => {
  test('checkCourseOwnership: null userId always returns no_user', () => {
    fc.assert(
      fc.property(fc.option(courseArb, { nil: null }), (course) => {
        const result = checkCourseOwnership(null, course)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('no_user')
      }),
      { numRuns: 100 }
    )
  })

  test('checkCourseOwnership: null course always returns not_found', () => {
    fc.assert(
      fc.property(uuidArb, (userId) => {
        const result = checkCourseOwnership(userId, null)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('not_found')
      }),
      { numRuns: 100 }
    )
  })

  test('checkCourseOwnership: both null returns no_user (userId checked first)', () => {
    const result = checkCourseOwnership(null, null)
    expect(result.authorized).toBe(false)
    expect(result.reason).toBe('no_user')
  })

  test('checkUnitOwnership: any null entity returns not_found or no_user', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(unitArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, unit, course) => {
          const result = checkUnitOwnership(userId, unit, course)

          if (!userId) {
            expect(result.reason).toBe('no_user')
          } else if (!unit || !course) {
            expect(result.reason).toBe('not_found')
          }
          // When all present, result depends on ownership
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkLessonOwnership: any null entity returns not_found or no_user', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(lessonArb, { nil: null }),
        fc.option(unitArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, lesson, unit, course) => {
          const result = checkLessonOwnership(userId, lesson, unit, course)

          if (!userId) {
            expect(result.reason).toBe('no_user')
          } else if (!lesson || !unit || !course) {
            expect(result.reason).toBe('not_found')
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkLessonItemOwnership: any null entity returns not_found or no_user', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(lessonItemArb, { nil: null }),
        fc.option(lessonArb, { nil: null }),
        fc.option(unitArb, { nil: null }),
        fc.option(courseArb, { nil: null }),
        (userId, item, lesson, unit, course) => {
          const result = checkLessonItemOwnership(userId, item, lesson, unit, course)

          if (!userId) {
            expect(result.reason).toBe('no_user')
          } else if (!item || !lesson || !unit || !course) {
            expect(result.reason).toBe('not_found')
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkLessonProgressOwnership: null userId returns no_user', () => {
    fc.assert(
      fc.property(lessonProgressArb, (progress) => {
        const result = checkLessonProgressOwnership(null, progress)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('no_user')
      }),
      { numRuns: 100 }
    )
  })

  test('checkLessonProgressOwnership: null progress returns not_found', () => {
    fc.assert(
      fc.property(uuidArb, (userId) => {
        const result = checkLessonProgressOwnership(userId, null)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('not_found')
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property: No user can authorize a resource they don't own
// (Single-owner exclusivity)
// ============================================

describe('Single-Owner Exclusivity', () => {
  test('for any course, exactly one userId can be authorized', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        courseArb,
        (userId1, userId2, course) => {
          const r1 = checkCourseOwnership(userId1, course)
          const r2 = checkCourseOwnership(userId2, course)

          if (userId1 === course.user_id) {
            expect(r1.authorized).toBe(true)
          } else {
            expect(r1.authorized).toBe(false)
          }

          if (userId2 === course.user_id) {
            expect(r2.authorized).toBe(true)
          } else {
            expect(r2.authorized).toBe(false)
          }

          // Both can be authorized only if they are the same user (who is the owner)
          if (r1.authorized && r2.authorized) {
            expect(userId1).toBe(userId2)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('for any lessonProgress, exactly one userId can be authorized', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        lessonProgressArb,
        (userId1, userId2, progress) => {
          const r1 = checkLessonProgressOwnership(userId1, progress)
          const r2 = checkLessonProgressOwnership(userId2, progress)

          if (r1.authorized && r2.authorized) {
            expect(userId1).toBe(userId2)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Check priority order
// no_user is checked before not_found, which is before not_owner
// ============================================

describe('Error Priority Order', () => {
  test('no_user has highest priority across all check functions', () => {
    fc.assert(
      fc.property(
        fc.option(courseArb, { nil: null }),
        fc.option(unitArb, { nil: null }),
        fc.option(lessonArb, { nil: null }),
        fc.option(lessonItemArb, { nil: null }),
        (course, unit, lesson, item) => {
          expect(checkCourseOwnership(null, course).reason).toBe('no_user')
          expect(checkUnitOwnership(null, unit, course).reason).toBe('no_user')
          expect(checkLessonOwnership(null, lesson, unit, course).reason).toBe('no_user')
          expect(checkLessonItemOwnership(null, item, lesson, unit, course).reason).toBe('no_user')
        }
      ),
      { numRuns: 100 }
    )
  })

  test('not_found takes priority over not_owner when entity is missing', () => {
    fc.assert(
      fc.property(uuidArb, (userId) => {
        // Course is null => not_found, not not_owner
        expect(checkCourseOwnership(userId, null).reason).toBe('not_found')

        // Unit is null => not_found
        expect(checkUnitOwnership(userId, null, null).reason).toBe('not_found')

        // Lesson is null => not_found
        expect(checkLessonOwnership(userId, null, null, null).reason).toBe('not_found')

        // LessonItem is null => not_found
        expect(checkLessonItemOwnership(userId, null, null, null, null).reason).toBe('not_found')
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property: Broken chain detection
// If foreign keys don't match, even the owner gets not_found
// ============================================

describe('Broken Chain Detection', () => {
  test('unit with mismatched course_id returns not_found even for owner', () => {
    fc.assert(
      fc.property(uuidArb, courseArb, unitArb, (userId, course, unit) => {
        const ownedCourse: Course = { ...course, user_id: userId }
        // Ensure unit points to a DIFFERENT course
        fc.pre(unit.course_id !== ownedCourse.id)

        const result = checkUnitOwnership(userId, unit, ownedCourse)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('not_found')
      }),
      { numRuns: 200 }
    )
  })

  test('lesson with mismatched unit_id returns not_found even for owner', () => {
    fc.assert(
      fc.property(uuidArb, courseArb, unitArb, lessonArb, (userId, course, unit, lesson) => {
        const ownedCourse: Course = { ...course, user_id: userId }
        const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id }
        // Ensure lesson points to a DIFFERENT unit
        fc.pre(lesson.unit_id !== linkedUnit.id)

        const result = checkLessonOwnership(userId, lesson, linkedUnit, ownedCourse)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('not_found')
      }),
      { numRuns: 200 }
    )
  })

  test('lessonItem with mismatched lesson_id returns not_found even for owner', () => {
    fc.assert(
      fc.property(
        uuidArb, courseArb, unitArb, lessonArb, lessonItemArb,
        (userId, course, unit, lesson, item) => {
          const ownedCourse: Course = { ...course, user_id: userId }
          const linkedUnit: Unit = { ...unit, course_id: ownedCourse.id }
          const linkedLesson: Lesson = { ...lesson, unit_id: linkedUnit.id }
          // Ensure item points to a DIFFERENT lesson
          fc.pre(item.lesson_id !== linkedLesson.id)

          const result = checkLessonItemOwnership(
            userId, item, linkedLesson, linkedUnit, ownedCourse
          )
          expect(result.authorized).toBe(false)
          expect(result.reason).toBe('not_found')
        }
      ),
      { numRuns: 200 }
    )
  })

  test('unit-course chain break also breaks lesson check', () => {
    fc.assert(
      fc.property(
        uuidArb, courseArb, unitArb, lessonArb,
        (userId, course, unit, lesson) => {
          const ownedCourse: Course = { ...course, user_id: userId }
          // Unit does NOT point to course
          fc.pre(unit.course_id !== ownedCourse.id)
          const linkedLesson: Lesson = { ...lesson, unit_id: unit.id }

          const result = checkLessonOwnership(userId, linkedLesson, unit, ownedCourse)
          expect(result.authorized).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})
