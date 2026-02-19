import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  loginSchema,
  registerSchema,
  createDeckSchema,
  createCardSchema,
  ratingSchema,
} from '../lib/validations';

/**
 * **Feature: cekatan, Property 13: Zod Validation Rejects Invalid Inputs**
 * **Validates: Requirements 1.3, 9.1, 9.2**
 *
 * For any input that violates the Zod schema constraints (invalid email format,
 * password too short, empty required fields), the validation SHALL return a
 * failure result with structured error messages.
 */
describe('Property 13: Zod Validation Rejects Invalid Inputs', () => {
  // Generator for invalid emails (missing @, empty, or malformed)
  const invalidEmailArb = fc.oneof(
    fc.constant(''),
    fc.string().filter((s) => !s.includes('@') && s.length > 0),
    fc.string().map((s) => s.replace(/@/g, '') + '@'),
    fc.string().map((s) => '@' + s.replace(/@/g, '')),
    fc.string().map((s) => s.replace(/@/g, '') + '@.'),
  );

  // Generator for short passwords (less than 6 characters)
  const shortPasswordArb = fc.string({ minLength: 0, maxLength: 5 });

  // Generator for invalid UUIDs
  const invalidUuidArb = fc.oneof(
    fc.constant(''),
    fc.string().filter((s) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return !uuidRegex.test(s);
    }),
  );

  // Generator for invalid ratings (not 1, 2, 3, or 4)
  const invalidRatingArb = fc.integer().filter((n) => n < 1 || n > 4);

  describe('loginSchema', () => {
    test('rejects invalid email formats', () => {
      fc.assert(
        fc.property(invalidEmailArb, fc.string({ minLength: 6 }), (email, password) => {
          const result = loginSchema.safeParse({ email, password });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
            expect(result.error.issues.some((issue) => issue.path.includes('email'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    test('rejects passwords shorter than 6 characters', () => {
      fc.assert(
        fc.property(shortPasswordArb, (password) => {
          const result = loginSchema.safeParse({ email: 'test@example.com', password });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
            expect(result.error.issues.some((issue) => issue.path.includes('password'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('registerSchema', () => {
    test('rejects invalid email formats', () => {
      fc.assert(
        fc.property(invalidEmailArb, fc.string({ minLength: 6 }), (email, password) => {
          const result = registerSchema.safeParse({
            email,
            password,
            confirmPassword: password,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    test('rejects mismatched passwords', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 6 }),
          fc.string({ minLength: 6 }),
          (password1, password2) => {
            fc.pre(password1 !== password2);
            const result = registerSchema.safeParse({
              email: 'test@example.com',
              password: password1,
              confirmPassword: password2,
            });
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(
                result.error.issues.some((issue) => issue.path.includes('confirmPassword'))
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('createDeckSchema', () => {
    test('rejects empty titles', () => {
      const result = createDeckSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes('title'))).toBe(true);
      }
    });

    test('rejects titles longer than 100 characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 101, maxLength: 200 }), (title) => {
          const result = createDeckSchema.safeParse({ title });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('title'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('createCardSchema', () => {
    test('rejects invalid deck IDs', () => {
      fc.assert(
        fc.property(
          invalidUuidArb,
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (deckId, front, back) => {
            const result = createCardSchema.safeParse({ deckId, front, back });
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.issues.some((issue) => issue.path.includes('deckId'))).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects empty front content', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (back) => {
          const result = createCardSchema.safeParse({
            deckId: '550e8400-e29b-41d4-a716-446655440000',
            front: '',
            back,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('front'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    test('rejects empty back content', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (front) => {
          const result = createCardSchema.safeParse({
            deckId: '550e8400-e29b-41d4-a716-446655440000',
            front,
            back: '',
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('back'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ratingSchema', () => {
    test('rejects invalid card IDs', () => {
      fc.assert(
        fc.property(invalidUuidArb, fc.constantFrom(1, 2, 3, 4), (cardId, rating) => {
          const result = ratingSchema.safeParse({ cardId, rating });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('cardId'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    test('rejects invalid ratings (not 1, 2, 3, or 4)', () => {
      fc.assert(
        fc.property(invalidRatingArb, (rating) => {
          const result = ratingSchema.safeParse({
            cardId: '550e8400-e29b-41d4-a716-446655440000',
            rating,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});
