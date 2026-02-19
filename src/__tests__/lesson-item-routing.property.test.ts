import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import type { LessonItem, Card, LessonItemType, CardType } from '../types/database';

/**
 * Lesson Item Type Routing Property-Based Tests
 * 
 * These tests verify the correctness properties of lesson item type routing
 * as specified in the design document.
 * 
 * **Feature: cekatan, Property 9: Lesson Item Type Routing**
 * **Validates: Requirements 5.2, 5.3**
 */

// Generator for valid UUIDs
const uuidArb = fc.uuid();

// Generator for valid ISO date strings using integer timestamps
// Using timestamps from 2020-01-01 to 2030-12-31
const minTimestamp = new Date('2020-01-01').getTime();
const maxTimestamp = new Date('2030-12-31').getTime();
const isoDateStringArb = fc.integer({ min: minTimestamp, max: maxTimestamp })
  .map(ts => new Date(ts).toISOString());

// Generator for lesson item type
const lessonItemTypeArb: fc.Arbitrary<LessonItemType> = fc.constantFrom('mcq', 'card');

// Generator for a LessonItem with specific type
const lessonItemArb = (itemType: LessonItemType) => fc.record({
  id: uuidArb,
  lesson_id: uuidArb,
  item_type: fc.constant(itemType),
  item_id: uuidArb,
  order_index: fc.integer({ min: 0, max: 1000 }),
  created_at: isoDateStringArb,
});

// Generator for an MCQ card
const mcqCardArb = (cardId: string) => fc.record({
  id: fc.constant(cardId),
  deck_id: uuidArb,
  card_type: fc.constant('mcq' as CardType),
  front: fc.constant(''),
  back: fc.constant(''),
  stem: fc.string({ minLength: 1, maxLength: 200 }),
  options: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
  correct_index: fc.integer({ min: 0, max: 4 }),
  explanation: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  image_url: fc.option(fc.webUrl(), { nil: null }),
  interval: fc.integer({ min: 1, max: 365 }),
  ease_factor: fc.double({ min: 1.3, max: 3.0, noNaN: true }),
  next_review: isoDateStringArb,
  created_at: isoDateStringArb,
});

// Generator for a flashcard
const flashcardArb = (cardId: string) => fc.record({
  id: fc.constant(cardId),
  deck_id: uuidArb,
  card_type: fc.constant('flashcard' as CardType),
  front: fc.string({ minLength: 1, maxLength: 200 }),
  back: fc.string({ minLength: 1, maxLength: 200 }),
  stem: fc.constant(null),
  options: fc.constant(null),
  correct_index: fc.constant(null),
  explanation: fc.constant(null),
  image_url: fc.option(fc.webUrl(), { nil: null }),
  interval: fc.integer({ min: 1, max: 365 }),
  ease_factor: fc.double({ min: 1.3, max: 3.0, noNaN: true }),
  next_review: isoDateStringArb,
  created_at: isoDateStringArb,
});

/**
 * Type representing the study flow to use for an item
 */
export type StudyFlowType = 'mcq' | 'flashcard';

/**
 * Pure function that determines which study flow to use based on item_type.
 * This is the core routing logic we want to test.
 * 
 * Requirements:
 * - 5.2: MCQ items route to MCQ study flow
 * - 5.3: Card items route to flashcard study flow
 */
export function determineStudyFlow(itemType: LessonItemType): StudyFlowType {
  if (itemType === 'mcq') {
    return 'mcq';
  }
  return 'flashcard';
}

/**
 * Pure function that validates if a card matches its expected item type.
 * MCQ items should have MCQ cards, card items should have flashcards.
 */
export function validateItemCardMatch(item: LessonItem, card: Card): boolean {
  if (item.item_type === 'mcq') {
    // MCQ items should have MCQ cards with required fields
    return (
      card.card_type === 'mcq' &&
      card.stem !== null &&
      card.options !== null &&
      card.correct_index !== null
    );
  }
  // Card items should have flashcard cards with required fields
  return (
    card.card_type === 'flashcard' &&
    card.front !== '' &&
    card.back !== ''
  );
}

/**
 * Pure function that checks if a card is renderable as MCQ.
 * Used to verify MCQ routing requirements.
 */
export function isMCQRenderable(card: Card): boolean {
  return (
    card.stem !== null &&
    card.options !== null &&
    Array.isArray(card.options) &&
    card.options.length >= 2 &&
    card.correct_index !== null &&
    card.correct_index >= 0 &&
    card.correct_index < card.options.length
  );
}

/**
 * Pure function that checks if a card is renderable as flashcard.
 * Used to verify flashcard routing requirements.
 */
export function isFlashcardRenderable(card: Card): boolean {
  return card.front !== '' || card.back !== '';
}

describe('Property 9: Lesson Item Type Routing', () => {
  /**
   * For any lesson_item with item_type 'mcq', the item SHALL be handled
   * by the MCQ study flow.
   */
  test('MCQ items route to MCQ study flow', () => {
    fc.assert(
      fc.property(
        lessonItemArb('mcq'),
        (item) => {
          const flow = determineStudyFlow(item.item_type);
          expect(flow).toBe('mcq');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * For any lesson_item with item_type 'card', the item SHALL be handled
   * by the flashcard study flow.
   */
  test('Card items route to flashcard study flow', () => {
    fc.assert(
      fc.property(
        lessonItemArb('card'),
        (item) => {
          const flow = determineStudyFlow(item.item_type);
          expect(flow).toBe('flashcard');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * For any item_type, the routing is deterministic - same input always
   * produces same output.
   */
  test('Routing is deterministic', () => {
    fc.assert(
      fc.property(
        lessonItemTypeArb,
        (itemType) => {
          const flow1 = determineStudyFlow(itemType);
          const flow2 = determineStudyFlow(itemType);
          expect(flow1).toBe(flow2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * The routing function covers all possible item types exhaustively.
   */
  test('All item types have a defined routing', () => {
    const allItemTypes: LessonItemType[] = ['mcq', 'card'];
    
    for (const itemType of allItemTypes) {
      const flow = determineStudyFlow(itemType);
      expect(['mcq', 'flashcard']).toContain(flow);
    }
  });

  /**
   * MCQ cards have all required fields for MCQ rendering.
   */
  test('MCQ cards are renderable as MCQ', () => {
    fc.assert(
      fc.property(
        uuidArb.chain(cardId => mcqCardArb(cardId)),
        (card) => {
          // Ensure correct_index is within bounds
          const validCard = {
            ...card,
            correct_index: Math.min(card.correct_index, card.options.length - 1),
          };
          expect(isMCQRenderable(validCard)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Flashcards have all required fields for flashcard rendering.
   */
  test('Flashcards are renderable as flashcard', () => {
    fc.assert(
      fc.property(
        uuidArb.chain(cardId => flashcardArb(cardId)),
        (card) => {
          expect(isFlashcardRenderable(card)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * MCQ items paired with MCQ cards pass validation.
   */
  test('MCQ items with MCQ cards pass validation', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        (lessonId, cardId) => {
          const item: LessonItem = {
            id: 'item-1',
            lesson_id: lessonId,
            item_type: 'mcq',
            item_id: cardId,
            order_index: 0,
            created_at: new Date().toISOString(),
          };

          const card: Card = {
            id: cardId,
            deck_id: 'deck-1',
            card_type: 'mcq',
            front: '',
            back: '',
            stem: 'What is the answer?',
            options: ['A', 'B', 'C', 'D'],
            correct_index: 0,
            explanation: null,
            image_url: null,
            interval: 1,
            ease_factor: 2.5,
            next_review: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          expect(validateItemCardMatch(item, card)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Card items paired with flashcards pass validation.
   */
  test('Card items with flashcards pass validation', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (lessonId, cardId, front, back) => {
          const item: LessonItem = {
            id: 'item-1',
            lesson_id: lessonId,
            item_type: 'card',
            item_id: cardId,
            order_index: 0,
            created_at: new Date().toISOString(),
          };

          const card: Card = {
            id: cardId,
            deck_id: 'deck-1',
            card_type: 'flashcard',
            front,
            back,
            stem: null,
            options: null,
            correct_index: null,
            explanation: null,
            image_url: null,
            interval: 1,
            ease_factor: 2.5,
            next_review: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };

          expect(validateItemCardMatch(item, card)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Mixed lesson items route correctly based on their individual types.
   */
  test('Mixed lesson items route correctly', () => {
    fc.assert(
      fc.property(
        fc.array(lessonItemTypeArb, { minLength: 1, maxLength: 20 }),
        (itemTypes) => {
          const items: LessonItem[] = itemTypes.map((itemType, i) => ({
            id: `item-${i}`,
            lesson_id: 'lesson-1',
            item_type: itemType,
            item_id: `card-${i}`,
            order_index: i,
            created_at: new Date().toISOString(),
          }));

          for (const item of items) {
            const flow = determineStudyFlow(item.item_type);
            if (item.item_type === 'mcq') {
              expect(flow).toBe('mcq');
            } else {
              expect(flow).toBe('flashcard');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Routing preserves item identity - the item itself is not modified.
   */
  test('Routing does not modify the item', () => {
    fc.assert(
      fc.property(
        lessonItemTypeArb,
        uuidArb,
        uuidArb,
        fc.integer({ min: 0, max: 1000 }),
        (itemType, lessonId, itemId, orderIndex) => {
          const item: LessonItem = {
            id: 'item-1',
            lesson_id: lessonId,
            item_type: itemType,
            item_id: itemId,
            order_index: orderIndex,
            created_at: new Date().toISOString(),
          };

          const originalItem = { ...item };
          determineStudyFlow(item.item_type);

          // Item should be unchanged
          expect(item).toEqual(originalItem);
        }
      ),
      { numRuns: 100 }
    );
  });
});
