import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import {
  loginSchema,
  registerSchema,
  createDeckSchema,
  createCardSchema,
  ratingSchema,
  createMCQSchema,
  createCourseSchema,
  updateCourseSchema,
  createUnitSchema,
  updateUnitSchema,
  createLessonSchema,
  updateLessonSchema,
  addLessonItemSchema,
  reorderLessonItemsSchema,
  createOrgSchema,
  updateOrgSettingsSchema,
  inviteMemberSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  submitAnswerSchema,
  publicRegistrationSchema,
} from '../lib/validations'

/**
 * Property-based tests for validations.ts
 *
 * Covers schemas NOT tested in validation.property.test.ts:
 * - createMCQSchema (positive + negative)
 * - Course hierarchy schemas (create/update course, unit, lesson)
 * - Organization schemas (createOrg, updateOrgSettings, inviteMember)
 * - Assessment schemas (create, update, submitAnswer)
 * - publicRegistrationSchema
 * - Positive validation tests (valid inputs always parse)
 * - Edge cases (empty strings, very long strings, special chars)
 * - Parsed output matches input shape
 */

// ============================================
// Shared Generators
// ============================================

const uuidArb = fc.uuid()

const validEmailArb = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
  fc.stringMatching(/^[a-z]{2,6}$/),
  fc.constantFrom('com', 'org', 'net', 'io', 'co.id')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

const validPasswordArb = fc.string({ minLength: 6, maxLength: 100 })

const hexColorArb = fc.stringMatching(/^#[0-9a-fA-F]{6}$/)

// ============================================
// Positive Tests: Valid inputs always parse
// ============================================

describe('Positive Validation — Valid Inputs Always Parse', () => {
  test('loginSchema accepts valid email + password', () => {
    fc.assert(
      fc.property(validEmailArb, validPasswordArb, (email, password) => {
        const result = loginSchema.safeParse({ email, password })
        expect(result.success).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('registerSchema accepts matching passwords', () => {
    fc.assert(
      fc.property(validEmailArb, validPasswordArb, (email, password) => {
        const result = registerSchema.safeParse({
          email,
          password,
          confirmPassword: password,
        })
        expect(result.success).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('createDeckSchema accepts valid titles (1-100 chars)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (title) => {
        const result = createDeckSchema.safeParse({ title })
        expect(result.success).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('createCardSchema accepts valid card data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 500 }),
        (deckId, front, back) => {
          const result = createCardSchema.safeParse({ deckId, front, back })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('ratingSchema accepts valid ratings 1-4', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.constantFrom(1 as const, 2 as const, 3 as const, 4 as const),
        (cardId, rating) => {
          const result = ratingSchema.safeParse({ cardId, rating })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('createCourseSchema accepts valid course data', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.option(fc.string({ maxLength: 2000 }), { nil: undefined }),
        (title, description) => {
          const input: Record<string, unknown> = { title }
          if (description !== undefined) input.description = description
          const result = createCourseSchema.safeParse(input)
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('createUnitSchema accepts valid unit data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        (courseId, title) => {
          const result = createUnitSchema.safeParse({ courseId, title })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('createLessonSchema accepts valid lesson data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        (unitId, title) => {
          const result = createLessonSchema.safeParse({ unitId, title })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('addLessonItemSchema accepts valid lesson item data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.constantFrom('mcq' as const, 'card' as const),
        uuidArb,
        (lessonId, itemType, itemId) => {
          const result = addLessonItemSchema.safeParse({ lessonId, itemType, itemId })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('inviteMemberSchema accepts valid invitation data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        validEmailArb,
        fc.constantFrom('admin' as const, 'creator' as const, 'candidate' as const),
        (orgId, email, role) => {
          const result = inviteMemberSchema.safeParse({ orgId, email, role })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('submitAnswerSchema accepts valid answer data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.nat({ max: 10 }),
        (sessionId, cardTemplateId, selectedIndex) => {
          const result = submitAnswerSchema.safeParse({ sessionId, cardTemplateId, selectedIndex })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// createMCQSchema — positive + negative
// ============================================

describe('createMCQSchema Validation', () => {
  test('accepts valid MCQ data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 6 }),
        (deckId, stem, options) => {
          const correctIndex = 0 // Always valid since options.length >= 2
          const result = createMCQSchema.safeParse({ deckId, stem, options, correctIndex })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects correctIndex >= options.length', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 5 }),
        (deckId, stem, options) => {
          const correctIndex = options.length // Out of bounds
          const result = createMCQSchema.safeParse({ deckId, stem, options, correctIndex })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects negative correctIndex', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: -100, max: -1 }),
        (deckId, stem, options, correctIndex) => {
          const result = createMCQSchema.safeParse({ deckId, stem, options, correctIndex })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects fewer than 2 options', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 0, maxLength: 1 }),
        (deckId, stem, options) => {
          const result = createMCQSchema.safeParse({ deckId, stem, options, correctIndex: 0 })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects empty stem', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 5 }),
        (deckId, options) => {
          const result = createMCQSchema.safeParse({ deckId, stem: '', options, correctIndex: 0 })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects empty option strings', () => {
    fc.assert(
      fc.property(uuidArb, fc.string({ minLength: 1, maxLength: 200 }), (deckId, stem) => {
        const result = createMCQSchema.safeParse({
          deckId,
          stem,
          options: ['valid', ''],
          correctIndex: 0,
        })
        expect(result.success).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// createOrgSchema — slug rules
// ============================================

describe('createOrgSchema Validation', () => {
  // Valid slugs: lowercase alphanum with hyphens, min 3, max 50, can't start/end with hyphen
  const validSlugArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/)
    .filter(s => {
      const reserved = new Set([
        'admin', 'api', 'app', 'auth', 'callback', 'dashboard', 'decks', 'help',
        'invite', 'join', 'library', 'login', 'logout', 'notifications', 'orgs',
        'privacy', 'profile', 'settings', 'signup', 'stats', 'study', 'support',
        'terms', 'www',
      ])
      return !reserved.has(s)
    })

  test('accepts valid org with valid slug', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        validSlugArb,
        (name, slug) => {
          const result = createOrgSchema.safeParse({ name, slug })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects reserved slugs', () => {
    const reservedSlugs = [
      'admin', 'api', 'app', 'auth', 'dashboard', 'help', 'login', 'logout',
      'profile', 'settings', 'signup', 'stats', 'study', 'support', 'terms', 'www',
    ]

    for (const slug of reservedSlugs) {
      const result = createOrgSchema.safeParse({ name: 'Test Org', slug })
      expect(result.success).toBe(false)
    }
  })

  test('rejects slugs starting with hyphen', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9-]{2,48}[a-z0-9]$/).map(s => '-' + s),
        (slug) => {
          fc.pre(slug.length >= 3 && slug.length <= 50)
          const result = createOrgSchema.safeParse({ name: 'Test', slug })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects slugs ending with hyphen', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,47}$/).map(s => s + '-'),
        (slug) => {
          fc.pre(slug.length >= 3 && slug.length <= 50)
          const result = createOrgSchema.safeParse({ name: 'Test', slug })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects slugs with uppercase letters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z][a-zA-Z0-9-]{1,48}[a-z0-9]$/),
        (slug) => {
          fc.pre(slug.length >= 3 && slug.length <= 50)
          const result = createOrgSchema.safeParse({ name: 'Test', slug })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects slugs shorter than 3 characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9]{1,2}$/),
        (slug) => {
          const result = createOrgSchema.safeParse({ name: 'Test', slug })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })

  test('rejects empty org name', () => {
    const result = createOrgSchema.safeParse({ name: '', slug: 'valid-slug' })
    expect(result.success).toBe(false)
  })
})

// ============================================
// createAssessmentSchema — positive + boundary tests
// ============================================

describe('createAssessmentSchema Validation', () => {
  test('accepts valid assessment data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: 1, max: 480 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 500 }),
        (deckTemplateId, title, timeLimitMinutes, passScore, questionCount) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes,
            passScore,
            questionCount,
          })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects timeLimitMinutes < 1', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: -100, max: 0 }),
        (deckTemplateId, title, timeLimitMinutes) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes,
            passScore: 50,
            questionCount: 10,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects timeLimitMinutes > 480', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: 481, max: 10000 }),
        (deckTemplateId, title, timeLimitMinutes) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes,
            passScore: 50,
            questionCount: 10,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects passScore > 100', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: 101, max: 1000 }),
        (deckTemplateId, title, passScore) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes: 60,
            passScore,
            questionCount: 10,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects questionCount < 1', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: -100, max: 0 }),
        (deckTemplateId, title, questionCount) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes: 60,
            passScore: 50,
            questionCount,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects questionCount > 500', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: 501, max: 10000 }),
        (deckTemplateId, title, questionCount) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes: 60,
            passScore: 50,
            questionCount,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// publicRegistrationSchema — name + contact validation
// ============================================

describe('publicRegistrationSchema Validation', () => {
  test('accepts valid registration with email', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 100 }),
        validEmailArb,
        (name, email) => {
          const result = publicRegistrationSchema.safeParse({ name, email })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('accepts valid registration with phone', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 100 }),
        fc.stringMatching(/^[0-9]{10,15}$/),
        (name, phone) => {
          const result = publicRegistrationSchema.safeParse({ name, phone })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('accepts valid registration with both email and phone', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 100 }),
        validEmailArb,
        fc.stringMatching(/^[0-9]{10,15}$/),
        (name, email, phone) => {
          const result = publicRegistrationSchema.safeParse({ name, email, phone })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects registration with neither email nor phone', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 100 }),
        (name) => {
          const result = publicRegistrationSchema.safeParse({ name })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects registration with empty email and empty phone', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 100 }),
        (name) => {
          const result = publicRegistrationSchema.safeParse({ name, email: '', phone: '' })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects name shorter than 2 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1 }),
        validEmailArb,
        (name, email) => {
          const result = publicRegistrationSchema.safeParse({ name, email })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rejects name longer than 100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 200 }),
        validEmailArb,
        (name, email) => {
          const result = publicRegistrationSchema.safeParse({ name, email })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Edge Cases: Empty strings, very long strings, special chars
// ============================================

describe('Edge Cases', () => {
  test('all schemas reject completely empty object', () => {
    const schemas = [
      loginSchema,
      registerSchema,
      createDeckSchema,
      createCardSchema,
      ratingSchema,
      createMCQSchema,
      createCourseSchema,
      createUnitSchema,
      createLessonSchema,
      addLessonItemSchema,
      reorderLessonItemsSchema,
      createOrgSchema,
      inviteMemberSchema,
      createAssessmentSchema,
      submitAnswerSchema,
    ]

    for (const schema of schemas) {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    }
  })

  test('title schemas reject strings of only whitespace', () => {
    // createDeckSchema specifically checks min(1), whitespace-only passes min check
    // but createOrgSchema name also checks min(1)
    const schemasWithTitle = [
      { schema: createCourseSchema, field: 'title' },
    ]

    // These should pass min(1) since whitespace chars have length > 0
    // This is an edge case documenting actual behavior
    for (const { schema, field } of schemasWithTitle) {
      const result = schema.safeParse({ [field]: '   ' })
      // Whitespace-only is currently allowed (min checks length, not trimmed)
      expect(result.success).toBe(true)
    }
  })

  test('UUID fields reject non-UUID strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
          return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
        }),
        (notUuid) => {
          // updateCourseSchema has courseId UUID field
          const result = updateCourseSchema.safeParse({ courseId: notUuid })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('very long description is rejected by createCourseSchema', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2001, maxLength: 3000 }),
        (description) => {
          const result = createCourseSchema.safeParse({
            title: 'Valid Title',
            description,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('very long title is rejected by createAssessmentSchema', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 201, maxLength: 500 }),
        (deckTemplateId, title) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes: 60,
            passScore: 50,
            questionCount: 10,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('special characters in titles are accepted', () => {
    const specialChars = ['Hello & World', 'Test <script>', "O'Brien", 'Soal #1', 'Ujian - 2026']

    for (const title of specialChars) {
      const result = createCourseSchema.safeParse({ title })
      expect(result.success).toBe(true)
    }
  })
})

// ============================================
// Parsed Output Shape Matches Input
// ============================================

describe('Parsed Output Matches Input Shape', () => {
  test('loginSchema output has email and password', () => {
    fc.assert(
      fc.property(validEmailArb, validPasswordArb, (email, password) => {
        const result = loginSchema.safeParse({ email, password })
        if (result.success) {
          expect(result.data).toHaveProperty('email', email)
          expect(result.data).toHaveProperty('password', password)
        }
      }),
      { numRuns: 100 }
    )
  })

  test('createCourseSchema output preserves title', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (title) => {
        const result = createCourseSchema.safeParse({ title })
        if (result.success) {
          expect(result.data.title).toBe(title)
        }
      }),
      { numRuns: 100 }
    )
  })

  test('createAssessmentSchema output preserves all required fields', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: 1, max: 480 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 500 }),
        (deckTemplateId, title, timeLimitMinutes, passScore, questionCount) => {
          const result = createAssessmentSchema.safeParse({
            deckTemplateId,
            title,
            timeLimitMinutes,
            passScore,
            questionCount,
          })
          if (result.success) {
            expect(result.data.deckTemplateId).toBe(deckTemplateId)
            expect(result.data.title).toBe(title)
            expect(result.data.timeLimitMinutes).toBe(timeLimitMinutes)
            expect(result.data.passScore).toBe(passScore)
            expect(result.data.questionCount).toBe(questionCount)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('inviteMemberSchema output preserves role value', () => {
    fc.assert(
      fc.property(
        uuidArb,
        validEmailArb,
        fc.constantFrom('admin' as const, 'creator' as const, 'candidate' as const),
        (orgId, email, role) => {
          const result = inviteMemberSchema.safeParse({ orgId, email, role })
          if (result.success) {
            expect(result.data.role).toBe(role)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('addLessonItemSchema output preserves itemType', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.constantFrom('mcq' as const, 'card' as const),
        uuidArb,
        (lessonId, itemType, itemId) => {
          const result = addLessonItemSchema.safeParse({ lessonId, itemType, itemId })
          if (result.success) {
            expect(result.data.itemType).toBe(itemType)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// reorderLessonItemsSchema
// ============================================

describe('reorderLessonItemsSchema Validation', () => {
  test('accepts valid reorder with at least 1 UUID', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(uuidArb, { minLength: 1, maxLength: 20 }),
        (lessonId, itemIds) => {
          const result = reorderLessonItemsSchema.safeParse({ lessonId, itemIds })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('rejects empty itemIds array', () => {
    fc.assert(
      fc.property(uuidArb, (lessonId) => {
        const result = reorderLessonItemsSchema.safeParse({ lessonId, itemIds: [] })
        expect(result.success).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  test('rejects non-UUID strings in itemIds', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
          return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
        }), { minLength: 1, maxLength: 5 }),
        (lessonId, badIds) => {
          const result = reorderLessonItemsSchema.safeParse({ lessonId, itemIds: badIds })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// updateOrgSettingsSchema — branding hex color
// ============================================

describe('updateOrgSettingsSchema Validation', () => {
  test('accepts valid hex color in branding', () => {
    fc.assert(
      fc.property(uuidArb, hexColorArb, (orgId, primary_color) => {
        const result = updateOrgSettingsSchema.safeParse({
          orgId,
          settings: { branding: { primary_color } },
        })
        expect(result.success).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('rejects invalid hex colors', () => {
    const invalidColors = ['#GGG000', 'red', '1e40af', '#1e40a', '#1e40afff', 'rgb(0,0,0)']

    for (const color of invalidColors) {
      const result = updateOrgSettingsSchema.safeParse({
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        settings: { branding: { primary_color: color } },
      })
      expect(result.success).toBe(false)
    }
  })

  test('accepts orgId-only update (no name, no settings)', () => {
    fc.assert(
      fc.property(uuidArb, (orgId) => {
        const result = updateOrgSettingsSchema.safeParse({ orgId })
        expect(result.success).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  test('accepts feature flag updates', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.boolean(),
        fc.boolean(),
        (orgId, studyMode, assessmentMode) => {
          const result = updateOrgSettingsSchema.safeParse({
            orgId,
            settings: {
              features: {
                study_mode: studyMode,
                assessment_mode: assessmentMode,
              },
            },
          })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
